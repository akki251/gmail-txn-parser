/**
 * Deterministic Financial Intelligence Engine
 * Generates scored insights based purely on local transaction history.
 */

export function generateInsights(transactions) {
  const debits = transactions.filter((t) => t.type === 'debit' && !t.notATransaction && (t.amount || 0) > 0);
  
  // Data Sufficiency
  let dataSufficiency = 'sufficient';
  if (transactions.length < 10) dataSufficiency = 'none';
  else if (transactions.length < 30) dataSufficiency = 'limited';

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Determine previous month
  const prevDate = new Date(now);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.getMonth();
  const prevYear = prevDate.getFullYear();

  // Helper: Filter by month/year
  const isMonth = (dateStr, month, year) => {
    if (!dateStr || dateStr === 'Today') return month === currentMonth && year === currentYear;
    const d = new Date(dateStr);
    return d.getMonth() === month && d.getFullYear() === year;
  };

  const currentMonthTxns = debits.filter(t => isMonth(t.date || t.rawDate, currentMonth, currentYear));
  const prevMonthTxns = debits.filter(t => isMonth(t.date || t.rawDate, prevMonth, prevYear));

  const currentMonthTotal = currentMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
  const prevMonthTotal = prevMonthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

  // 1. MONTHLY SUMMARY
  let monthlySummary = null;
  if (dataSufficiency !== 'none') {
    let trend = '';
    let comparison = '';
    if (prevMonthTotal > 0) {
      const diff = currentMonthTotal - prevMonthTotal;
      const pct = Math.round(Math.abs(diff) / prevMonthTotal * 100);
      trend = diff > 0 ? `↑ ${pct}% from last month` : `↓ ${pct}% from last month`;
      comparison = diff > 0 
        ? "Your spending is higher than your usual monthly pace." 
        : "You are spending less than last month.";
    } else {
      trend = `${currentMonthTxns.length} transactions`;
      comparison = "We're still learning your spending patterns.";
    }
    
    monthlySummary = {
      id: 'monthly_summary',
      value: currentMonthTotal,
      trend,
      comparison,
      monthName: now.toLocaleString('default', { month: 'long' })
    };
  }

  const allInsights = [];

  // Helper: group by category
  const getCategoryTotals = (txns) => {
    const cats = {};
    txns.forEach(t => {
      const c = t.category || 'Miscellaneous';
      cats[c] = (cats[c] || 0) + (t.amount || 0);
    });
    return cats;
  };

  const currentCats = getCategoryTotals(currentMonthTxns);
  const prevCats = getCategoryTotals(prevMonthTxns);

  // 2. CATEGORY SPIKES & TRENDS
  const trends = [];
  Object.keys(currentCats).forEach(cat => {
    const cur = currentCats[cat];
    const prev = prevCats[cat] || 0;
    
    // Trend reporting
    if (prev > 0) {
      const diff = cur - prev;
      const pct = Math.round(Math.abs(diff) / prev * 100);
      trends.push({ category: cat, amount: cur, pct, isUp: diff > 0 });
    }

    // High impact spike (if it's at least 20% increase and over ₹2000 difference)
    if (prev > 0 && cur > prev && (cur - prev) > 2000 && (cur / prev) > 1.2) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      allInsights.push({
        id: `spike_${cat}`,
        type: 'category_spike',
        title: 'BIGGEST CHANGE',
        headline: `${cat} spending is up ${pct}%`,
        value: cur,
        comparison: `vs ₹${prev.toLocaleString('en-IN')} last month`,
        description: `Most of the increase came from recent transactions in this category.`,
        confidence: 0.9,
        action: 'View transactions',
        score: (cur - prev) + (pct * 100) // Magnitude + % weight
      });
    }

    // Miscellaneous Analysis
    if (cat === 'Miscellaneous' && cur > (currentMonthTotal * 0.2) && cur > 5000) {
      const miscTxns = currentMonthTxns.filter(t => (t.category || 'Miscellaneous') === 'Miscellaneous').sort((a, b) => b.amount - a.amount);
      if (miscTxns.length > 0) {
        const top3 = miscTxns.slice(0, 3).reduce((s, t) => s + t.amount, 0);
        const top3Pct = Math.round((top3 / cur) * 100);
        
        allInsights.push({
          id: 'misc_spike',
          type: 'miscellaneous_spike',
          title: 'CATEGORY ANALYSIS',
          headline: 'Miscellaneous is unusually high',
          value: cur,
          comparison: `${Math.round((cur/currentMonthTotal)*100)}% of your spending`,
          description: top3Pct > 50 ? `${miscTxns.length > 3 ? '3' : miscTxns.length} large transactions account for ${top3Pct}% of this category.` : `Review these transactions to improve your spending picture.`,
          supportingTransactions: miscTxns.slice(0, 3),
          confidence: 0.85,
          action: 'Review transactions',
          score: cur * 1.5 // High priority if unclassified money is huge
        });
      }
    }
  });

  // Sort trends
  trends.sort((a, b) => b.amount - a.amount);

  // 3. UNUSUAL ACTIVITY
  // Calculate historical mean and std dev (simplistic approach for offline)
  const amounts = debits.map(t => t.amount);
  const mean = amounts.length ? amounts.reduce((a,b)=>a+b,0)/amounts.length : 0;
  const variance = amounts.length ? amounts.reduce((a,b)=>a + Math.pow(b - mean, 2),0)/amounts.length : 0;
  const stdDev = Math.sqrt(variance);
  
  const unusualTxns = [];
  if (amounts.length > 10 && stdDev > 0) {
    currentMonthTxns.forEach(t => {
      // If a transaction is > Mean + 3 StdDevs OR is just exceptionally large compared to the rest
      if (t.amount > mean + (stdDev * 3) && t.amount > 3000) {
        unusualTxns.push(t);
        allInsights.push({
          id: `unusual_${t.id}`,
          type: 'unusual_transaction',
          title: 'WORTH A LOOK',
          headline: t.merchant || 'Unknown',
          value: t.amount,
          comparison: t.category || 'Miscellaneous',
          description: `That's significantly higher than your usual transactions.`,
          confidence: 0.95,
          action: 'View details',
          score: t.amount * 2 // Extremely large single transactions are highly interesting
        });
      }
    });
  }

  // Find the single absolute largest this month if no unusual threshold triggered
  if (unusualTxns.length === 0 && currentMonthTxns.length > 0) {
    const maxTxn = [...currentMonthTxns].sort((a,b)=>b.amount-a.amount)[0];
    if (maxTxn.amount > 2000) { // arbitrary threshold to care
      allInsights.push({
        id: `largest_${maxTxn.id}`,
        type: 'largest_transaction',
        title: 'WORTH A LOOK',
        headline: maxTxn.merchant || 'Unknown',
        value: maxTxn.amount,
        comparison: maxTxn.category || 'Miscellaneous',
        description: `Your largest transaction this month.`,
        confidence: 0.8,
        action: 'View details',
        score: maxTxn.amount
      });
    }
  }

  // 4. RECURRING COMMITMENTS
  const merchantFreq = {};
  debits.forEach(t => {
    const m = t.merchant;
    if (m && m !== 'of Rs') {
      if (!merchantFreq[m]) merchantFreq[m] = [];
      merchantFreq[m].push(t);
    }
  });

  const recurring = [];
  Object.keys(merchantFreq).forEach(m => {
    const txns = merchantFreq[m];
    if (txns.length >= 2) {
      // Check if amounts are identical or very close
      const amt = txns[0].amount;
      const isConsistentAmount = txns.every(t => Math.abs(t.amount - amt) < (amt * 0.1));
      if (isConsistentAmount && amt > 100) {
        recurring.push({ merchant: m, amount: amt, count: txns.length });
      }
    }
  });
  
  let recurringTotal = 0;
  if (recurring.length > 0) {
    recurringTotal = recurring.reduce((s, r) => s + r.amount, 0);
    allInsights.push({
      id: 'recurring_summary',
      type: 'recurring_payment',
      title: 'RECURRING',
      headline: `${recurring.length} recurring payments`,
      value: recurringTotal,
      comparison: '/ month',
      description: `You have ₹${recurringTotal.toLocaleString('en-IN')} in recurring subscriptions every month.`,
      confidence: 0.85,
      action: 'Manage subscriptions',
      score: recurringTotal * 1.2
    });
  }

  // 5. PAY LATER / CREDIT
  const payLaterKeywords = ['simpl', 'lazypay', 'axio', 'postpaid', 'credit card', 'cc bill'];
  let payLaterOut = 0;
  currentMonthTxns.forEach(t => {
    const m = (t.merchant || '').toLowerCase();
    const inst = (t.instrument || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    
    if (payLaterKeywords.some(k => m.includes(k) || inst.includes(k) || cat.includes(k))) {
      payLaterOut += t.amount;
    }
  });

  let payLaterSection = null;
  if (payLaterOut > 1000) {
    payLaterSection = {
      title: 'PAY LATER & CREDIT',
      amount: payLaterOut,
      description: `You have spent ₹${payLaterOut.toLocaleString('en-IN')} via Pay Later and Credit instruments this month.`
    };
  }

  // 6. SCORING & HERO SELECTION
  let heroInsight = null;
  let remainingInsights = [];
  
  if (allInsights.length > 0) {
    // Sort descending by score
    allInsights.sort((a, b) => b.score - a.score);
    heroInsight = allInsights[0];
    remainingInsights = allInsights.slice(1);
  }

  return {
    dataSufficiency,
    summary: monthlySummary,
    hero: heroInsight,
    otherInsights: remainingInsights,
    trends: trends.slice(0, 4), // Top 4 trends
    recurring: recurring.slice(0, 5), // Top 5 recurring
    payLater: payLaterSection
  };
}

export function formatReadableDate(isoString) {
  if (!isoString) return 'Unknown Date';
  if (isoString === 'Today' || isoString === 'Yesterday') return isoString;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  } catch(e) {
    return isoString;
  }
}

export function formatReadableDateTime(isoString) {
  if (!isoString) return 'Unknown Date';
  if (isoString === 'Today' || isoString === 'Yesterday') return isoString;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch(e) {
    return isoString;
  }
}
