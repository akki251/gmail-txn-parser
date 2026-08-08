const fs = require('fs');
const path = require('path');
const { categorize, CATEGORIES } = require('./categorize');
const { llmFallbackExtract } = require('./llmFallback');

const DB_PATH = path.join(__dirname, 'db.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    return { transactions: {}, friends: {}, splits: [], nextFriendId: 1, nextSplitId: 1 };
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ---- transactions ----

// Same real-world transaction can arrive via two channels (e.g. a bank's
// email + SMS alert for the same payment) with different message IDs, so
// messageId-based idempotency alone won't catch it. refNo (a UPI reference
// number) is shared across every channel for the same transaction, so it's
// checked first as a strong signal; same bank + amount + type within a
// short window is a weaker fallback for when refNo isn't available on one
// side.
const CROSS_SOURCE_WINDOW_MS = 5 * 60 * 1000;

function findCrossSourceDuplicate(db, parsed, isoDate) {
  const candidates = Object.values(db.transactions);

  if (parsed.refNo) {
    const byRef = candidates.find((t) => t.refNo && t.refNo === parsed.refNo);
    if (byRef) return byRef;
  }

  if (isoDate && typeof parsed.amount === 'number') {
    const targetMs = new Date(isoDate).getTime();
    const byAmountAndTime = candidates.find((t) => {
      if (t.bank !== parsed.bank || t.type !== parsed.type || t.amount !== parsed.amount) return false;
      if (!t.date) return false;
      return Math.abs(new Date(t.date).getTime() - targetMs) <= CROSS_SOURCE_WINDOW_MS;
    });
    if (byAmountAndTime) return byAmountAndTime;
  }

  return null;
}

// Returns true if newly inserted, false if this messageId was already ingested
// (idempotency — same guarantee webhook.js relies on for push redelivery) OR
// it's a cross-source duplicate of a transaction already stored (e.g. the
// same payment alerted by both email and SMS) — either way, nothing new to
// insert.
function upsertTransaction(messageId, parsed, date) {
  const db = load();
  if (db.transactions[messageId]) return false;
  if (findCrossSourceDuplicate(db, parsed, date)) return false;

  db.transactions[messageId] = {
    id: messageId,
    date: date || null,
    ...parsed,
    category: categorize(parsed.merchant, parsed.bank),
    splitStatus: 'unsplit',
  };
  save(db);
  return true;
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
  return { ...txn, splits };
}

function listAll() {
  const db = load();
  return Object.values(db.transactions).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
