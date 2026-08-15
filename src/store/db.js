/**
 * Flat-JSON Local Storage for Android React Native (expo-file-system).
 * Manages transactions, source messages, expense splits, friends, and needsReview queue.
 */
import * as FileSystem from 'expo-file-system';

const DB_FILENAME = 'db.json';
let localDbPath = null;

let memoryDb = {
  transactions: {},
  sourceMessages: {},
  friends: [
    { id: 'f1', name: 'Alex', email: 'alex@example.com' },
    { id: 'f2', name: 'Sam', email: 'sam@example.com' },
  ],
  splits: {},
  categories: [
    { id: 'c1', name: 'Food & Dining', icon: 'utensils' },
    { id: 'c2', name: 'Shopping', icon: 'shopping-bag' },
    { id: 'c3', name: 'Utilities', icon: 'zap' },
    { id: 'c4', name: 'Entertainment', icon: 'film' },
    { id: 'c5', name: 'Travel', icon: 'plane' },
  ],
};

function getDbPath() {
  if (localDbPath) return localDbPath;
  if (FileSystem && FileSystem.documentDirectory) {
    localDbPath = FileSystem.documentDirectory + DB_FILENAME;
  } else {
    localDbPath = DB_FILENAME;
  }
  return localDbPath;
}

async function loadDb() {
  const filePath = getDbPath();
  try {
    if (FileSystem && FileSystem.documentDirectory) {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(filePath);
        memoryDb = JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn('[DB] Using default memory database:', err.message);
  }
  return memoryDb;
}

async function saveDb() {
  const filePath = getDbPath();
  try {
    const data = JSON.stringify(memoryDb, null, 2);
    if (FileSystem && FileSystem.documentDirectory) {
      await FileSystem.writeAsStringAsync(filePath, data);
    }
  } catch (err) {
    console.error('[DB] Failed to persist database:', err);
  }
}

function getTransactions() {
  return Object.values(memoryDb.transactions || {}).sort((a, b) => new Date(b.date || b.rawDate || 0) - new Date(a.date || a.rawDate || 0));
}

function getNeedsReviewQueue() {
  return Object.values(memoryDb.transactions || {}).filter((t) => t.needsReview || t.unparsed);
}

function getFriends() {
  return memoryDb.friends || [];
}

function getSplits() {
  return memoryDb.splits || {};
}

async function addTransaction(transaction) {
  // Prevent duplicate insertion of identical SMS raw text
  if (transaction.rawText) {
    const existing = Object.values(memoryDb.transactions || {}).find(
      (t) => t.rawText && t.rawText.trim() === transaction.rawText.trim()
    );
    if (existing) return existing;
  }

  const id = transaction.id || `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record = {
    id,
    date: transaction.date || new Date().toISOString(),
    status: 'Approved',
    ...transaction,
  };
  memoryDb.transactions[id] = record;
  await saveDb();
  return record;
}

async function updateTransaction(id, updates) {
  if (!memoryDb.transactions[id]) return null;
  memoryDb.transactions[id] = {
    ...memoryDb.transactions[id],
    ...updates,
    needsReview: false,
  };
  await saveDb();
  return memoryDb.transactions[id];
}

async function createSplit(transactionId, splitData) {
  const splitId = `split_${transactionId}`;
  memoryDb.splits[splitId] = {
    id: splitId,
    transactionId,
    amount: splitData.amount,
    payer: splitData.payer || 'You',
    participants: splitData.participants || [],
    createdAt: new Date().toISOString(),
  };

  if (memoryDb.transactions[transactionId]) {
    memoryDb.transactions[transactionId].isSplit = true;
    memoryDb.transactions[transactionId].splitId = splitId;
  }
  await saveDb();
  return memoryDb.splits[splitId];
}

async function addFriend(name) {
  const friend = {
    id: `f_${Date.now()}`,
    name,
  };
  memoryDb.friends.push(friend);
  await saveDb();
  return friend;
}

async function clearAllData() {
  memoryDb.transactions = {};
  memoryDb.sourceMessages = {};
  memoryDb.splits = {};
  await saveDb();
}

module.exports = {
  loadDb,
  saveDb,
  getTransactions,
  getNeedsReviewQueue,
  getFriends,
  getSplits,
  addTransaction,
  updateTransaction,
  createSplit,
  addFriend,
  clearAllData,
};
