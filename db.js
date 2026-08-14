const fs = require('fs');
const path = require('path');
const { categorize, CATEGORIES } = require('./categorize');
const { llmFallbackExtract, llmMatchTransactions } = require('./llmFallback');
const { matchSource } = require('./matchingEngine');
const stats = require('./pipelineStats');

const DB_PATH = path.join(__dirname, 'db.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    return { transactions: {}, sourceMessages: {}, friends: {}, splits: [], nextFriendId: 1, nextSplitId: 1 };
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (!db.sourceMessages) db.sourceMessages = {}; // pre-migration db.json — see migrate-source-messages.js
  return db;
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Every SMS/email is a source message from a known bank sender (`sourceParser`
// values from bankParsers.js all read e.g. "ICICI Bank" for email; from
// smsParsers.js they read e.g. "ICICI Bank SMS" — the " SMS" suffix is the
// one place that distinction is encoded today, so it's the cheapest correct
// signal rather than adding a new parameter through every call site).
function inferSourceType(sourceParser) {
  return /\sSMS$/.test(sourceParser || '') ? 'sms' : 'email';
}

// A minimal in-process write lock: db.json is a single file with no
// database-level transaction support, and `upsertTransaction` now does an
// async matching step (possibly an AI call) between its read and its
// write. Without this, two concurrent ingests (e.g. the SMS webhook firing
// while a Gmail fetch is mid-run) could both load() the same starting
// state and the second save() would silently clobber the first. Chaining
// every ingest through one promise queue serializes them within this
// process — enough for a single-instance personal server; genuine
// multi-process/multi-machine concurrency would need a real database, out
// of scope for this file format.
let writeChain = Promise.resolve();
function withWriteLock(fn) {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

// ---- transactions ----

// Returns true if a NEW canonical transaction was created, false if this
// source message was either (a) already ingested before (idempotent
// retry — matches webhook.js's push-redelivery guarantee) or (b) matched
// to an existing canonical transaction and attached as an additional
// source (e.g. the same payment's SMS arriving after its email already
// created the transaction, or vice versa — order-independent). Either way
// "false" means: nothing new for the caller to report.
async function upsertTransaction(messageId, parsed, date) {
  return withWriteLock(async () => {
    const db = load();
    if (db.sourceMessages[messageId]) return false; // idempotent retry, same source message

    const sourceType = inferSourceType(parsed.sourceParser);

    // A needsReview placeholder has no structured fields to match against
    // yet — store it as its own transaction (as before) and let
    // retryNeedsReview's later heal fold it into normal flow.
    if (parsed.needsReview) {
      db.sourceMessages[messageId] = {
        id: messageId,
        sourceType,
        bank: null,
        receivedAt: date || null,
        matchedTransactionId: null,
        matchMethod: null,
        matchConfidence: null,
      };
      db.transactions[messageId] = {
        id: messageId,
        date: date || null,
        ...parsed,
        category: categorize(parsed.merchant, parsed.bank),
        splitStatus: 'unsplit',
        sourceIds: [messageId],
      };
      save(db);
      return true;
    }

    const sourceRecord = {
      bank: parsed.bank || null,
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant || null,
      refNo: parsed.refNo || null,
      last4: parsed.last4 || null,
      account: parsed.account || null,
      date: date || null,
      sourceType,
    };

    // Each candidate needs to know which channel(s) already contributed to
    // it, so the matching engine can refuse to match this source against
    // a candidate that already has a source of the SAME channel (see the
    // comment on this check in matchingEngine.js's passesHardFilters).
    const candidates = Object.values(db.transactions)
      .filter((t) => !t.notATransaction && !t.needsReview)
      .map((t) => ({
        ...t,
        sourceTypes: (t.sourceIds || [t.id])
          .map((sid) => db.sourceMessages[sid] && db.sourceMessages[sid].sourceType)
          .filter(Boolean),
      }));
    // AI arbitration only if a key is actually configured — matchSource
    // itself already only reaches this for the genuinely ambiguous score
    // band, so this isn't gating volume, just graceful degradation when
    // no key is set (falls back to "no match", never a crash).
    const aiMatchFn = process.env.OPENROUTER_API_KEY ? llmMatchTransactions : null;
    const matchResult = await matchSource(sourceRecord, candidates, aiMatchFn);

    db.sourceMessages[messageId] = {
      id: messageId,
      sourceType,
      bank: parsed.bank || null,
      receivedAt: date || null,
      matchedTransactionId: matchResult ? matchResult.matchedTransaction.id : null,
      matchMethod: matchResult ? matchResult.method : null,
      matchConfidence: matchResult ? matchResult.confidence : null,
    };

    stats.recordEvent('matchAttempts');
    if (matchResult) {
      const eventByMethod = {
        reference: 'matchedByReference',
        deterministic: 'matchedByDeterministic',
        score: 'matchedByScore',
        ai: 'matchedByAI',
      };
      stats.recordEvent(eventByMethod[matchResult.method]);

      const target = db.transactions[matchResult.matchedTransaction.id];
      target.sourceIds = [...(target.sourceIds || [target.id]), messageId];
      save(db);
      return false;
    }

    stats.recordEvent('unmatchedNew');
    db.transactions[messageId] = {
      id: messageId,
      date: date || null,
      ...parsed,
      category: categorize(parsed.merchant, parsed.bank),
      splitStatus: 'unsplit',
      sourceIds: [messageId],
    };
    save(db);
    return true;
  });
}

function setAcknowledged(id, acknowledged) {
  const db = load();
  if (!db.transactions[id]) throw new Error('Unknown transaction: ' + id);
  db.transactions[id].acknowledged = !!acknowledged;
  save(db);
}

function setCategory(id, category) {
  if (!CATEGORIES.includes(category)) throw new Error('Unknown category: ' + category);
  const db = load();
  if (!db.transactions[id]) throw new Error('Unknown transaction: ' + id);
  db.transactions[id].category = category;
  save(db);
}

function getTransaction(id) {
  const db = load();
  const txn = db.transactions[id];
  if (!txn) return null;
  const splits = db.splits
    .filter((s) => s.transactionId === id)
    .map((s) => ({
      friendName: (db.friends[s.friendId] || {}).name || 'Unknown',
      shareAmount: s.shareAmount,
      settled: s.settled,
    }));
  // Resolved source messages this canonical transaction was built from —
  // observability into why/how a match happened (match_method + confidence
  // per source), without exposing raw SMS/email text by default.
  const sources = (txn.sourceIds || [id])
    .map((sourceId) => db.sourceMessages[sourceId])
    .filter(Boolean)
    .map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      receivedAt: s.receivedAt,
      matchMethod: s.matchMethod,
      matchConfidence: s.matchConfidence,
    }));
  return { ...txn, splits, sources };
}

function listAll() {
  const db = load();
  return Object.values(db.transactions)
    .filter((t) => !t.notATransaction)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function listUnsplit() {
  const db = load();
  return Object.values(db.transactions).filter(
    (t) => t.splitStatus === 'unsplit' && t.type === 'debit' && t.status !== 'Declined' && !t.needsReview
  );
}

function listNeedsReview() {
  const db = load();
  return Object.values(db.transactions).filter((t) => t.needsReview);
}

// Re-attempts LLM extraction on a stored needs-review record. On success,
// the raw placeholder becomes a real transaction (fields merged in,
// category computed, flag cleared). On failure, stays flagged with the
// latest failure reason — never silently re-dropped.
async function retryNeedsReview(id) {
  const db = load();
  const txn = db.transactions[id];
  if (!txn || !txn.needsReview) return false;

  try {
    const extracted = await llmFallbackExtract(txn.rawText);
    if (extracted.notATransaction) {
      db.transactions[id].needsReview = false;
      db.transactions[id].notATransaction = true;
      save(db);
      return true;
    }
    db.transactions[id] = {
      ...txn,
      ...extracted,
      needsReview: false,
      lastFailureReason: undefined,
      category: categorize(extracted.merchant, extracted.bank),
    };
    save(db);
    return true;
  } catch (err) {
    db.transactions[id].lastFailureReason = err.message;
    save(db);
    return false;
  }
}

function markPersonal(id) {
  const db = load();
  if (!db.transactions[id]) throw new Error('Unknown transaction: ' + id);
  db.transactions[id].splitStatus = 'personal';
  save(db);
}

// ---- friends ----

function findOrCreateFriend(db, name) {
  const existing = Object.values(db.friends).find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const id = db.nextFriendId++;
  const friend = { id, name };
  db.friends[id] = friend;
  return friend;
}

function listFriends() {
  const db = load();
  return Object.values(db.friends);
}

// ---- splits ----

// Even split across friends + you (n+1 ways); pass customShares = {name: amount}
// to override. Friends owe you their share; your own share isn't tracked
// (it's just your money, not a debt).
function splitTransaction(transactionId, friendNames, customShares) {
  const db = load();
  const txn = db.transactions[transactionId];
  if (!txn) throw new Error('Unknown transaction: ' + transactionId);
  if (txn.splitStatus === 'split') throw new Error('Already split: ' + transactionId);
  if (txn.needsReview) throw new Error('This transaction needs review before it can be split: ' + transactionId);

  const friends = friendNames.map((name) => findOrCreateFriend(db, name));

  let shares;
  if (customShares) {
    // customShares keys come from client input and may not match an
    // existing friend's stored casing (findOrCreateFriend matches names
    // case-insensitively) — resolve against the canonical friend.name so
    // a lookup miss doesn't silently produce NaN shares.
    shares = {};
    friends.forEach((f) => {
      const key = Object.keys(customShares).find((k) => k.toLowerCase() === f.name.toLowerCase());
      shares[f.name] = key !== undefined ? customShares[key] : 0;
    });
  } else {
    const n = friends.length + 1;
    const each = Math.round((txn.amount / n) * 100) / 100;
    shares = {};
    friends.forEach((f) => (shares[f.name] = each));
  }

  for (const friend of friends) {
    db.splits.push({
      id: db.nextSplitId++,
      transactionId,
      friendId: friend.id,
      shareAmount: shares[friend.name],
      settled: false,
    });
  }

  db.transactions[transactionId].splitStatus = 'split';
  save(db);
  return shares;
}

function ledger() {
  const db = load();
  const balances = {};
  for (const split of db.splits) {
    if (split.settled) continue;
    const friend = db.friends[split.friendId];
    if (!friend) continue;
    balances[friend.name] = (balances[friend.name] || 0) + split.shareAmount;
  }
  return balances;
}

// amount omitted -> settle everything that friend owes
function settle(friendName, amount) {
  const db = load();
  const friend = Object.values(db.friends).find((f) => f.name.toLowerCase() === friendName.toLowerCase());
  if (!friend) throw new Error('Unknown friend: ' + friendName);

  let remaining = amount;
  for (const split of db.splits) {
    if (split.friendId !== friend.id || split.settled) continue;
    if (remaining === undefined) {
      split.settled = true;
    } else if (remaining > 0) {
      if (split.shareAmount <= remaining) {
        remaining -= split.shareAmount;
        split.settled = true;
      } else {
        split.shareAmount = Math.round((split.shareAmount - remaining) * 100) / 100;
        db.splits.push({
          id: db.nextSplitId++,
          transactionId: split.transactionId,
          friendId: friend.id,
          shareAmount: remaining,
          settled: true,
        });
        remaining = 0;
      }
    }
  }
  save(db);
}

module.exports = {
  upsertTransaction,
  listAll,
  listUnsplit,
  markPersonal,
  listFriends,
  splitTransaction,
  ledger,
  settle,
  setCategory,
  getTransaction,
  setAcknowledged,
  listNeedsReview,
  retryNeedsReview,
};
