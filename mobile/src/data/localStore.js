import AsyncStorage from '@react-native-async-storage/async-storage';
import initialData from './initialData.json';

const STORAGE_KEY_DB = '@finances_local_db_v4';

export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Travel & Commute',
  'Bills & Utilities',
  'Entertainment',
  'Health & Fitness',
  'Investments',
  'Transfers',
  'General',
  'Other',
];

export function parseTxnDate(item) {
  if (!item) return null;
  const raw = item.date || item.rawDate;
  if (!raw || raw === 'Today' || raw === 'Yesterday') return new Date();
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  const ddmmyyMatch = String(raw).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  const ddMonMatch = String(raw).match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/i);
  if (ddMonMatch) {
    const day = parseInt(ddMonMatch[1], 10);
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[ddMonMatch[2].toLowerCase()] ?? 0;
    let year = parseInt(ddMonMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return null;
}

export const loadLocalDb = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.transactions) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[LocalStore Load Error]:', err);
  }

  // Pre-seed with initialData.json
  const friendsMap = {};
  if (Array.isArray(initialData.friends)) {
    initialData.friends.forEach((f) => {
      if (f && f.name) friendsMap[f.id || f.name] = f;
    });
  } else if (initialData.friends) {
    Object.assign(friendsMap, initialData.friends);
  }

  const seeded = {
    transactions: initialData.transactions || {},
    sourceMessages: initialData.sourceMessages || {},
    friends: friendsMap,
    splits: initialData.splits || [],
    ledger: initialData.ledger || {},
    nextFriendId: initialData.nextFriendId || 10,
    nextSplitId: initialData.nextSplitId || 10,
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY_DB, JSON.stringify(seeded));
  } catch {}

  return seeded;
};

export const saveLocalDb = async (db) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DB, JSON.stringify(db));
  } catch (err) {
    console.error('[LocalStore Save Error]:', err);
  }
};

export const localStore = {
  getCategories: () => CATEGORIES,

  getTransactions: async () => {
    const db = await loadLocalDb();
    return Object.values(db.transactions || {})
      .filter((t) => !t.notATransaction)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  },

  getUnsplit: async () => {
    const db = await loadLocalDb();
    return Object.values(db.transactions || {}).filter(
      (t) =>
        t.splitStatus === 'unsplit' &&
        t.type === 'debit' &&
        t.status !== 'Declined' &&
        !t.needsReview
    );
  },

  getFriends: async () => {
    const db = await loadLocalDb();
    return db.friends || {};
  },

  getLedger: async () => {
    const db = await loadLocalDb();
    const balances = { ...(db.ledger || {}) };
    const history = [];

    const splits = db.splits || [];
    const friends = db.friends || {};
    const txns = db.transactions || {};

    for (const split of splits) {
      const friend =
        Object.values(friends).find((f) => f.id === split.friendId) ||
        friends[split.friendId];
      if (!friend) continue;

      const txn = txns[split.transactionId];
      history.push({
        id: split.id,
        type: split.settled ? 'settle' : 'split',
        friendName: friend.name,
        amount: split.shareAmount,
        merchant: txn ? txn.merchant : 'Split',
        date: txn ? txn.date : new Date().toISOString(),
      });

      if (!split.settled) {
        balances[friend.name] = (balances[friend.name] || 0) + (split.shareAmount || 0);
      }
    }

    history.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { ...balances, history };
  },

  splitTransaction: async (transactionId, friendNames, customShares = null) => {
    const db = await loadLocalDb();
    const txn = db.transactions[transactionId];
    if (!txn) throw new Error('Transaction not found');

    if (!db.friends) db.friends = {};
    if (!db.splits) db.splits = [];
    if (!db.nextFriendId) db.nextFriendId = 1;
    if (!db.nextSplitId) db.nextSplitId = 1;

    // Normalize arguments: if friendNames is an object { friend: amount }
    let namesList = [];
    let sharesMap = customShares;
    if (Array.isArray(friendNames)) {
      namesList = friendNames;
    } else if (friendNames && typeof friendNames === 'object') {
      namesList = Object.keys(friendNames);
      if (!sharesMap) sharesMap = friendNames;
    }

    // Resolve or create friends
    const resolvedFriends = namesList.map((name) => {
      const existing = Object.values(db.friends).find(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return existing;
      const id = db.nextFriendId++;
      const newFriend = { id, name };
      db.friends[id] = newFriend;
      return newFriend;
    });

    let shares = {};
    if (sharesMap) {
      resolvedFriends.forEach((f) => {
        const key = Object.keys(sharesMap).find(
          (k) => k.toLowerCase() === f.name.toLowerCase()
        );
        shares[f.name] = key !== undefined ? Number(sharesMap[key]) : 0;
      });
    } else {
      const n = resolvedFriends.length + 1;
      const each = Math.round((txn.amount / n) * 100) / 100;
      resolvedFriends.forEach((f) => {
        shares[f.name] = each;
      });
    }

    for (const friend of resolvedFriends) {
      db.splits.push({
        id: db.nextSplitId++,
        transactionId,
        friendId: friend.id,
        shareAmount: shares[friend.name],
        settled: false,
      });

      if (!db.ledger) db.ledger = {};
      db.ledger[friend.name] = (db.ledger[friend.name] || 0) + shares[friend.name];
    }

    db.transactions[transactionId].splitStatus = 'split';
    db.transactions[transactionId].shares = shares;
    await saveLocalDb(db);
    return shares;
  },

  markPersonal: async (transactionId) => {
    const db = await loadLocalDb();
    if (!db.transactions[transactionId]) throw new Error('Transaction not found');
    db.transactions[transactionId].splitStatus = 'personal';
    await saveLocalDb(db);
  },

  setCategory: async (transactionId, category) => {
    const db = await loadLocalDb();
    if (!db.transactions[transactionId]) throw new Error('Transaction not found');
    db.transactions[transactionId].category = category;
    await saveLocalDb(db);
  },

  setAcknowledged: async (transactionId, acknowledged = true) => {
    const db = await loadLocalDb();
    if (!db.transactions[transactionId]) throw new Error('Transaction not found');
    db.transactions[transactionId].acknowledged = acknowledged;
    await saveLocalDb(db);
  },

  settleFriend: async (friendName, amount) => {
    const db = await loadLocalDb();
    const friend = Object.values(db.friends || {}).find(
      (f) => f.name.toLowerCase() === friendName.toLowerCase()
    );

    if (db.ledger && db.ledger[friendName] !== undefined) {
      if (amount === undefined || amount >= db.ledger[friendName]) {
        delete db.ledger[friendName];
      } else {
        db.ledger[friendName] -= amount;
      }
    }

    if (friend) {
      let remaining = amount;
      for (const split of db.splits || []) {
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
    }
    await saveLocalDb(db);
  },

  addManualTransaction: async ({ merchant, amount, type = 'debit', bank = 'Manual', category = 'General', date = new Date().toISOString() }) => {
    const db = await loadLocalDb();
    const id = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newTxn = {
      id,
      merchant,
      amount: parseFloat(amount) || 0,
      currency: 'INR',
      type,
      bank,
      category,
      date,
      status: 'Approved',
      splitStatus: 'unsplit',
      sourceIds: [id],
      sourceParser: 'Manual Entry',
    };
    db.transactions[id] = newTxn;
    await saveLocalDb(db);
    return newTxn;
  },

  deleteTransaction: async (transactionId) => {
    const db = await loadLocalDb();
    if (db.transactions && db.transactions[transactionId]) {
      delete db.transactions[transactionId];
    }
    if (Array.isArray(db.splits)) {
      db.splits = db.splits.filter((s) => s.transactionId !== transactionId);
    }
    if (db.sourceMessages) {
      for (const [msgId, msg] of Object.entries(db.sourceMessages)) {
        if (msg.matchedTransactionId === transactionId || msg.id === transactionId) {
          delete db.sourceMessages[msgId];
        }
      }
    }
    await saveLocalDb(db);
    return true;
  },


  resetData: async () => {
    const friendsMap = {};
    if (Array.isArray(initialData.friends)) {
      initialData.friends.forEach((f) => {
        if (f && f.name) friendsMap[f.id || f.name] = f;
      });
    } else if (initialData.friends) {
      Object.assign(friendsMap, initialData.friends);
    }

    const seeded = {
      transactions: initialData.transactions || {},
      sourceMessages: initialData.sourceMessages || {},
      friends: friendsMap,
      splits: initialData.splits || [],
      ledger: initialData.ledger || {},
      nextFriendId: initialData.nextFriendId || 10,
      nextSplitId: initialData.nextSplitId || 10,
    };
    await saveLocalDb(seeded);
    return seeded;
  },
};
