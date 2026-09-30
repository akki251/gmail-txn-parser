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
        'reference-partial': 'matchedByReference',
        deterministic: 'matchedByDeterministic',
        score: 'matchedByScore',
        ai: 'matchedByAI',
      };
      const eventName = eventByMethod[matchResult.method] || 'matchedByReference';
      stats.recordEvent(eventName);

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
// category computed, flag cleared) — or, if the now-resolved fields match
// an existing canonical transaction (e.g. the email arrived while this SMS
// was stuck in review), the placeholder is deleted and the source is
// attached to the existing transaction instead. On failure, stays flagged
// with the latest failure reason — never silently re-dropped.
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

    // Now that we have structured fields, check if this matches an
    // existing canonical transaction that arrived via another channel
    // while this source was stuck in needsReview.
    const sourceType = db.sourceMessages[id] ? db.sourceMessages[id].sourceType : inferSourceType(txn.sourceParser);
    const sourceRecord = {
      bank: extracted.bank || null,
      type: extracted.type,
      amount: extracted.amount,
      currency: extracted.currency,
      merchant: extracted.merchant || null,
      refNo: extracted.refNo || null,
      last4: extracted.last4 || null,
      account: extracted.account || null,
      date: txn.date || null,
      sourceType,
    };

    const candidates = Object.values(db.transactions)
      .filter((t) => t.id !== id && !t.notATransaction && !t.needsReview)
      .map((t) => ({
        ...t,
        sourceTypes: (t.sourceIds || [t.id])
          .map((sid) => db.sourceMessages[sid] && db.sourceMessages[sid].sourceType)
          .filter(Boolean),
      }));

    const aiMatchFn = process.env.OPENROUTER_API_KEY ? llmMatchTransactions : null;
    const matchResult = await matchSource(sourceRecord, candidates, aiMatchFn);

    if (matchResult) {
      // Merge into the existing canonical transaction — attach this
      // source and delete the needsReview placeholder.
      const target = db.transactions[matchResult.matchedTransaction.id];
      target.sourceIds = [...(target.sourceIds || [target.id]), id];
      if (db.sourceMessages[id]) {
        db.sourceMessages[id].matchedTransactionId = target.id;
        db.sourceMessages[id].matchMethod = matchResult.method;
        db.sourceMessages[id].matchConfidence = matchResult.confidence;
      }
      delete db.transactions[id];
      save(db);
      return true;
    }

    // No match — resolve in place as before.
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

function deleteTransaction(id) {
  const db = load();
  if (!db.transactions || !db.transactions[id]) return false;
  delete db.transactions[id];

  // Remove associated splits
  if (Array.isArray(db.splits)) {
    db.splits = db.splits.filter((s) => s.transactionId !== id);
  }


  // Remove or detach source messages
  if (db.sourceMessages) {
    for (const [msgId, msg] of Object.entries(db.sourceMessages)) {
      if (msg.matchedTransactionId === id || msg.id === id) {
        delete db.sourceMessages[msgId];
      }
    }
  }

  save(db);
  return true;
}

// ---- Credit Card Optimizer ----
const { DEFAULT_CARDS, getOptimizerOverview } = require('./cardOptimizer');

function getCards() {
  const db = load();
  if (!db.cards || !Array.isArray(db.cards) || db.cards.length === 0) {
    return DEFAULT_CARDS;
  }
  return db.cards;
}

function updateCard(cardId, updates) {
  const db = load();
  if (!db.cards || !Array.isArray(db.cards)) {
    db.cards = JSON.parse(JSON.stringify(DEFAULT_CARDS));
  }
  const idx = db.cards.findIndex(c => c.id === cardId);
  if (idx === -1) {
    return null;
  }
  // Sanitize numeric inputs
  if (updates.limit !== undefined) updates.limit = Number(updates.limit) || db.cards[idx].limit;
  if (updates.statementDay !== undefined) updates.statementDay = Number(updates.statementDay) || db.cards[idx].statementDay;
  if (updates.dueDay !== undefined) updates.dueDay = Number(updates.dueDay) || db.cards[idx].dueDay;

  db.cards[idx] = { ...db.cards[idx], ...updates };
  save(db);
  return db.cards[idx];
}

function getCardOptimizer(asOfDate) {
  const cards = getCards();
  const txns = listAll();
  return getOptimizerOverview(cards, txns, asOfDate);
}

// ---- Recurring Financial Obligations ----
const {
  getObligationsOverview,
  parseObligationEmail,
} = require('./obligationDetector');

const DEFAULT_EMAIL_NOTICES = [
  {
    id: 'notice_hdfc_life_001',
    merchant: 'HDFC Life Term Insurance',
    category: 'Insurance',
    amount: 18450,
    dueDate: '2026-10-12T00:00:00.000Z',
    frequency: 'Annual',
    refNumber: 'POL-HL-982144',
    isConfirmed: true,
    source: 'Email',
    confidence: 'High',
    rawSubject: 'Renewal Notice: Your HDFC Life Click 2 Protect Term Insurance Policy No. POL-HL-982144 is due for renewal on 12-Oct-2026',
    receivedAt: '2026-09-20T08:30:00.000Z',
  },
  {
    id: 'notice_star_health_002',
    merchant: 'Star Health Insurance',
    category: 'Insurance',
    amount: 24600,
    dueDate: '2026-11-15T00:00:00.000Z',
    frequency: 'Annual',
    refNumber: 'SH-FAM-554129',
    isConfirmed: true,
    source: 'Email',
    confidence: 'High',
    rawSubject: 'Star Health Family Optima Policy Renewal Reminder - Due on 15 Nov 2026',
    receivedAt: '2026-09-25T11:15:00.000Z',
  },
  {
    id: 'notice_airtel_fiber_003',
    merchant: 'Airtel Xstream Fiber',
    category: 'Utility',
    amount: 1179,
    dueDate: '2026-10-06T00:00:00.000Z',
    frequency: 'Monthly',
    refNumber: 'DSL-080-49219',
    isConfirmed: true,
    source: 'Email',
    confidence: 'High',
    rawSubject: 'Airtel Broadband Bill generated: Amount Rs. 1,179.00 due by 06-Oct-2026',
    receivedAt: '2026-09-22T04:20:00.000Z',
  },
];

function getEmailNotices() {
  const db = load();
  if (!db.emailNotices || !Array.isArray(db.emailNotices) || db.emailNotices.length === 0) {
    return DEFAULT_EMAIL_NOTICES;
  }
  return db.emailNotices;
}

function addEmailNotice(noticeData) {
  const db = load();
  if (!db.emailNotices || !Array.isArray(db.emailNotices)) {
    db.emailNotices = JSON.parse(JSON.stringify(DEFAULT_EMAIL_NOTICES));
  }
  let parsed = noticeData;
  if (noticeData.body || noticeData.subject) {
    const ext = parseObligationEmail(noticeData);
    if (ext) {
      parsed = { ...ext, ...noticeData };
    }
  }
  if (!parsed.id) {
    parsed.id = 'notice_' + Date.now();
  }
  db.emailNotices.push(parsed);
  save(db);
  return parsed;
}

function getObligationOverrides() {
  const db = load();
  return db.obligationOverrides || {};
}

function updateObligationOverride(obligationId, overrideData) {
  const db = load();
  if (!db.obligationOverrides) db.obligationOverrides = {};
  db.obligationOverrides[obligationId] = {
    ...(db.obligationOverrides[obligationId] || {}),
    ...overrideData,
    updatedAt: new Date().toISOString(),
  };
  save(db);
  return db.obligationOverrides[obligationId];
}

function getObligations(asOfDate) {
  const txns = listAll();
  const emailNotices = getEmailNotices();
  const overrides = getObligationOverrides();
  return getObligationsOverview(txns, emailNotices, overrides, asOfDate);
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
  deleteTransaction,
  getCards,
  updateCard,
  getCardOptimizer,
  getEmailNotices,
  addEmailNotice,
  getObligationOverrides,
  updateObligationOverride,
  getObligations,
};



