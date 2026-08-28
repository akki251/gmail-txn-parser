import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getServerUrl, setServerUrl, getSessionToken, setSessionToken } from '../api/client';
import { localStore, saveLocalDb, loadLocalDb, parseTxnDate, CATEGORIES } from '../data/localStore';
import * as Haptics from 'expo-haptics';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshingMail, setIsRefreshingMail] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [unsplitList, setUnsplitList] = useState([]);
  const [friends, setFriends] = useState({});
  const [ledger, setLedger] = useState({ balances: {}, history: [] });
  const [categories, setCategories] = useState(CATEGORIES);

  // Initial load
  useEffect(() => {
    (async () => {
      await refreshAll(false);
      setIsLoading(false);
    })();
  }, []);

  const refreshAll = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    setErrorMessage(null);

    try {
      // 1. Instant load from local storage (Offline First)
      const localTxns = await localStore.getTransactions();
      const localUnsplit = await localStore.getUnsplit();
      const localFriends = await localStore.getFriends();
      const localLedger = await localStore.getLedger();

      setTransactions(localTxns);
      setUnsplitList(localUnsplit);
      setFriends(localFriends);
      setLedger(localLedger);
      setCategories(CATEGORIES);

      // 2. Background sync with GCP Server
      try {
        await api.getHealth();
        setIsConnected(true);

        const [txnsRes, unsplitRes, friendsRes, ledgerRes] = await Promise.allSettled([
          api.getTransactions(),
          api.getUnsplit(),
          api.getFriends(),
          api.getLedger(),
        ]);

        const db = await loadLocalDb();

        if (txnsRes.status === 'fulfilled' && txnsRes.value) {
          const serverTxnsList = Array.isArray(txnsRes.value)
            ? txnsRes.value
            : Object.values(txnsRes.value);

          const serverMap = {};
          serverTxnsList.forEach((t) => {
            if (!t || !t.id) return;
            const d = parseTxnDate(t);
            // Only keep August 2026 onwards (discard previous dev months)
            if (d && (d.getFullYear() > 2026 || (d.getFullYear() === 2026 && d.getMonth() >= 7))) {
              serverMap[t.id] = t;
            }
          });
          // Preserve any local manual entries
          Object.entries(db.transactions || {}).forEach(([id, t]) => {
            if (id.startsWith('manual_')) serverMap[id] = t;
          });
          db.transactions = serverMap;
        }

        if (friendsRes.status === 'fulfilled' && friendsRes.value) {
          db.friends = { ...db.friends, ...friendsRes.value };
        }

        await saveLocalDb(db);

        const updatedTxns = await localStore.getTransactions();
        const updatedUnsplit = await localStore.getUnsplit();
        const updatedFriends = await localStore.getFriends();
        const updatedLedger = await localStore.getLedger();

        setTransactions(updatedTxns);
        setUnsplitList(updatedUnsplit);
        setFriends(updatedFriends);
        setLedger(updatedLedger);
        setLastSyncTime(new Date());
      } catch (netErr) {
        setIsConnected(false);
      }
    } catch (err) {
      console.warn('[Refresh Error]:', err);
      setErrorMessage(err.message || 'Failed to refresh data');
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  // Calculations for Metrics & Spending
  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let thisMonthSpend = 0;
    let lastMonthSpend = 0;
    let thisMonthIncome = 0;
    let needsReviewCount = 0;
    let unacknowledgedCount = 0;

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dailyCumulativeSpend = Array(daysInCurrentMonth).fill(0);
    const categoryTotals = {};
    const bankTotals = {};

    transactions.forEach((tx) => {
      if (!tx || tx.notATransaction) return;
      const d = parseTxnDate(tx);
      if (!d) return;

      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();
      const amount = Number(tx.amount) || 0;
      const isDebit = tx.type === 'debit';
      const isCredit = tx.type === 'credit';

      if (tx.needsReview) needsReviewCount++;
      if (tx.acknowledged === false) unacknowledgedCount++;

      // Current Month (August 2026)
      if (y === currentYear && m === currentMonth) {
        if (isDebit) {
          thisMonthSpend += amount;
          if (day >= 1 && day <= daysInCurrentMonth) {
            dailyCumulativeSpend[day - 1] += amount;
          }
          const cat = tx.category || 'Other';
          categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;

          const bank = tx.bank || 'Unknown Bank';
          bankTotals[bank] = (bankTotals[bank] || 0) + amount;
        } else if (isCredit) {
          thisMonthIncome += amount;
        }
      }

      // Previous Month - only considered if post-baseline (> August 2026)
      if (y === prevYear && m === prevMonth && (y > 2026 || (y === 2026 && m >= 7))) {
        if (isDebit) lastMonthSpend += amount;
      }
    });

    // Make daily spend cumulative
    let runningSum = 0;
    const currentDay = Math.min(now.getDate(), daysInCurrentMonth);
    for (let i = 0; i < daysInCurrentMonth; i++) {
      if (i < currentDay) {
        runningSum += dailyCumulativeSpend[i];
        dailyCumulativeSpend[i] = runningSum;
      } else {
        dailyCumulativeSpend[i] = null;
      }
    }

    // Trend % (Active from next month onwards against this baseline)
    let spendTrendPct = 0;
    if (lastMonthSpend > 0) {
      spendTrendPct = Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100);
    }

    // Category array sorted
    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: thisMonthSpend > 0 ? Math.round((amount / thisMonthSpend) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      thisMonthSpend: Math.round(thisMonthSpend),
      lastMonthSpend: Math.round(lastMonthSpend),
      thisMonthIncome: Math.round(thisMonthIncome),
      spendTrendPct,
      dailyCumulativeSpend,
      daysInCurrentMonth,
      currentDay,
      categoryBreakdown,
      bankTotals,
      needsReviewCount,
      unacknowledgedCount,
      unsplitCount: unsplitList.length,
    };
  }, [transactions, unsplitList]);

  // Ledger summary
  const ledgerSummary = useMemo(() => {
    let netBalance = 0;
    const owesYou = [];
    const youOwe = [];

    const balances = (ledger && typeof ledger === 'object') ? (ledger.balances || ledger) : {};
    Object.entries(balances).forEach(([friendName, net]) => {
      if (friendName === 'history' || friendName === 'balances') return;
      const num = Number(net) || 0;
      if (num === 0) return;
      netBalance += num;
      if (num > 0) {
        owesYou.push({ friendName, amount: num });
      } else if (num < 0) {
        youOwe.push({ friendName, amount: Math.abs(num) });
      }
    });

    owesYou.sort((a, b) => b.amount - a.amount);
    youOwe.sort((a, b) => b.amount - a.amount);

    return {
      netBalance,
      owesYou,
      youOwe,
      history: ledger.history || [],
    };
  }, [ledger]);

  // Actions
  const handleSplit = async (transactionId, selectedFriends, customShares = null) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await localStore.splitTransaction(transactionId, selectedFriends, customShares);
      try {
        await api.splitTransaction(transactionId, selectedFriends, customShares);
      } catch {}
      await refreshAll(true);
      return { ok: true };
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  };

  const handleMarkPersonal = async (transactionId) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await localStore.markPersonal(transactionId);
      try {
        await api.markPersonal(transactionId);
      } catch {}
      await refreshAll(true);
      return { ok: true };
    } catch (err) {
      throw err;
    }
  };

  const handleSettle = async (friendName, amount) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await localStore.settleFriend(friendName, amount);
      try {
        await api.settleFriend(friendName, amount);
      } catch {}
      await refreshAll(true);
      return { ok: true };
    } catch (err) {
      throw err;
    }
  };

  const handleSetCategory = async (transactionId, category) => {
    try {
      await Haptics.selectionAsync();
      await localStore.setCategory(transactionId, category);
      try {
        await api.setCategory(transactionId, category);
      } catch {}
      await refreshAll(true);
      return { ok: true };
    } catch (err) {
      throw err;
    }
  };

  const handleAcknowledge = async (transactionId, acknowledged = true) => {
    try {
      await Haptics.selectionAsync();
      await localStore.setAcknowledged(transactionId, acknowledged);
      try {
        await api.setAcknowledged(transactionId, acknowledged);
      } catch {}
      await refreshAll(true);
      return { ok: true };
    } catch (err) {
      throw err;
    }
  };

  const handleAddTransaction = async (txData) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await localStore.addManualTransaction(txData);
      await refreshAll(true);
      return res;
    } catch (err) {
      throw err;
    }
  };

  const handleResetData = async () => {
    await localStore.resetData();
    await refreshAll(false);
  };

  const handleTriggerSync = async () => {
    setIsRefreshingMail(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        await api.refreshServer();
      } catch {}
      await refreshAll(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    } finally {
      setIsRefreshingMail(false);
    }
  };

  const updateServerConfig = async (newUrl, password = null) => {
    const sanitized = await setServerUrl(newUrl);
    setServerUrlState(sanitized);
    if (password) {
      await api.login(password);
    }
    await refreshAll();
  };

  return (
    <AppContext.Provider
      value={{
        serverUrl,
        isLoading,
        isConnected,
        isSyncing,
        isRefreshingMail,
        lastSyncTime,
        errorMessage,
        transactions,
        unsplitList,
        friends,
        ledger,
        categories,
        metrics,
        ledgerSummary,
        refreshAll,
        handleSplit,
        handleMarkPersonal,
        handleSettle,
        handleSetCategory,
        handleAcknowledge,
        handleAddTransaction,
        handleResetData,
        handleTriggerSync,
        updateServerConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
