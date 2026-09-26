// cardOptimizer.js — Credit Card Billing Cycle & Utilization Optimizer
// Computes live card utilization, interest-free runway, and recommends the
// optimal card for big purchases based on statement closing dates.

const DEFAULT_CARDS = [
  {
    id: 'icici',
    name: 'ICICI Bank',
    variant: 'Coral / Amazon Pay',
    last4: 'XX3006',
    statementDay: 21,
    dueDay: 7, // 7th of next month (~17 days after statement)
    limit: 300000,
    themeColor: '#C8222A',
    aliases: ['3006', 'xx3006', '6789', 'xx6789', 'icici', 'icici bank'],
    description: 'Statement: 21st • Due: ~7th (next month)',
    bestSpendWindow: '22nd – 20th',
  },
  {
    id: 'indusind',
    name: 'IndusInd Bank',
    variant: 'Tiger Legend',
    last4: '9986',
    statementDay: 18,
    dueDay: 5, // 5th of next month (~17 days after statement)
    limit: 200000,
    themeColor: '#8A1538',
    aliases: ['9986', '4321', 'xx4321', 'indusind', 'indusind bank', 'tiger'],
    description: 'Statement: 18th • Due: 5th (next month)',
    bestSpendWindow: '18th – 17th',
  },
  {
    id: 'supermoney',
    name: 'Axis SuperMoney',
    variant: 'RuPay Credit Card',
    last4: 'XX92',
    statementDay: 17,
    dueDay: 5, // 5th of next month
    limit: 150000,
    themeColor: '#E01A4F',
    aliases: ['9992', 'xx9992', 'xx92', '92', 'supermoney', 'super.money'],
    description: 'Statement: 17th • Due: 5th (next month)',
    bestSpendWindow: '18th – 16th',
  },
  {
    id: 'swiggy_hdfc',
    name: 'Swiggy HDFC',
    variant: 'Cashback Card',
    last4: 'XX4587',
    statementDay: 16,
    dueDay: 5, // ~20 days after statement
    limit: 250000,
    themeColor: '#FC8019',
    aliases: ['4587', 'xx4587', '8901', 'swiggy', 'hdfc', 'hdfc bank'],
    description: 'Statement: 16th • Due: ~5th (next month)',
    bestSpendWindow: '17th – 15th',
  },
  {
    id: 'flipkart_axis',
    name: 'Flipkart Axis',
    variant: 'Cashback Card',
    last4: 'XX07',
    statementDay: 15,
    dueDay: 3, // 3rd of next month (~19 days after statement)
    limit: 200000,
    themeColor: '#2874F0',
    aliases: ['07', 'xx07', '8899', 'xx8899', '4567', 'flipkart', 'axis'],
    description: 'Statement: 15th • Due: 3rd (next month)',
    bestSpendWindow: '16th – 14th',
  },
  {
    id: 'sbi_phonepe',
    name: 'SBI PhonePe',
    variant: 'PhonePe SBI BLACK',
    last4: 'XX37',
    statementDay: 11,
    dueDay: 30, // 30th of same month (19-20 days after statement)
    limit: 150000,
    themeColor: '#5F259F',
    aliases: ['37', 'xx37', '5678', '9012', 'phonepe', 'sbi', 'sbi card'],
    description: 'Statement: 11th • Due: 30th',
    bestSpendWindow: '12th – 10th',
  },
  {
    id: 'indian_bank',
    name: 'Indian Bank One',
    variant: 'OneCard / RuPay',
    last4: 'OneCard',
    statementDay: 5,
    dueDay: 25, // 25th of same month (~20 days after statement)
    limit: 100000,
    themeColor: '#D4A017',
    aliases: ['indian bank', 'onecard', '7788', 'rupay'],
    description: 'Statement: 5th • Due: ~25th',
    bestSpendWindow: '6th – 4th',
  },
];

/**
 * Normalizes input date to local calendar day (year, month 0-indexed, day 1-indexed)
 */
function parseDateParts(inputDate) {
  const d = inputDate ? new Date(inputDate) : new Date();
  if (isNaN(d.getTime())) return parseDateParts(new Date());
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    dateObj: d,
  };
}

/**
 * Calculates statement dates and interest-free runway for a card as of a given date
 */
function getCardCycleInfo(card, asOfDate) {
  const { year, month, day, dateObj } = parseDateParts(asOfDate);
  const statementDay = card.statementDay;

  let lastStatementDate;
  let nextStatementDate;

  if (day >= statementDay) {
    // Current cycle started this month on statementDay
    lastStatementDate = new Date(year, month, statementDay, 0, 0, 0);
    // Next statement is next month on statementDay
    nextStatementDate = new Date(year, month + 1, statementDay, 23, 59, 59);
  } else {
    // Current cycle started last month on statementDay
    lastStatementDate = new Date(year, month - 1, statementDay, 0, 0, 0);
    // Next statement is this month on statementDay
    nextStatementDate = new Date(year, month, statementDay, 23, 59, 59);
  }

  // Calculate payment due date for spends made on asOfDate:
  // Spends on or after statementDay get billed in nextStatementDate,
  // and due roughly `dueDay` of the following month (or same month if dueDay > statementDay)
  let nextDueDate;
  const nYear = nextStatementDate.getFullYear();
  const nMonth = nextStatementDate.getMonth();

  if (card.dueDay > card.statementDay) {
    // Due later in the same month as statement (e.g. statement 11th, due 30th)
    nextDueDate = new Date(nYear, nMonth, card.dueDay);
  } else {
    // Due next month after statement (e.g. statement 21st, due 7th next month)
    nextDueDate = new Date(nYear, nMonth + 1, card.dueDay);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSinceStatement = Math.max(0, Math.floor((dateObj - lastStatementDate) / msPerDay));
  const daysUntilNextStatement = Math.max(0, Math.ceil((nextStatementDate - dateObj) / msPerDay));
  const interestFreeDays = Math.max(1, Math.round((nextDueDate - dateObj) / msPerDay));

  let cycleStatus = 'normal';
  let statusBadge = 'Good to use';

  if (day === statementDay) {
    cycleStatus = 'statement_day';
    statusBadge = 'Statement day';
  } else if (daysUntilNextStatement <= 2) {
    cycleStatus = 'avoid';
    statusBadge = 'Avoid (Stmnt soon)';
  } else if (daysSinceStatement >= 1 && daysSinceStatement <= 4) {
    cycleStatus = 'fresh';
    statusBadge = 'Fresh cycle';
  } else if (daysSinceStatement >= 5 && daysSinceStatement <= 14) {
    cycleStatus = 'good';
    statusBadge = 'Use freely';
  } else {
    cycleStatus = 'normal';
    statusBadge = 'Good window';
  }

  return {
    lastStatementDate,
    nextStatementDate,
    nextDueDate,
    daysSinceStatement,
    daysUntilNextStatement,
    interestFreeDays,
    cycleStatus,
    statusBadge,
  };
}

/**
 * Calculates spend in the current billing cycle from a list of transactions
 */
function calculateUtilization(card, transactions, cycleInfo) {
  const { lastStatementDate } = cycleInfo;
  const aliases = (card.aliases || []).map(a => a.toLowerCase());
  const cardId = card.id.toLowerCase();
  const cardLast4 = (card.last4 || '').replace(/[^0-9]/g, '');

  let currentCycleSpend = 0;
  let cycleDebitCount = 0;

  if (Array.isArray(transactions)) {
    for (const t of transactions) {
      if (t.notATransaction) continue;
      const tDate = new Date(t.date);
      if (isNaN(tDate.getTime()) || tDate < lastStatementDate) continue;

      // Match card identity
      const tBank = (t.bank || '').toLowerCase();
      const tLast4 = String(t.last4 || t.account || '').replace(/[^0-9]/g, '');
      const tSource = (t.sourceParser || '').toLowerCase();

      const bankMatches = aliases.some(a => tBank.includes(a) || tSource.includes(a));
      const last4Matches = cardLast4 && tLast4 && (tLast4.endsWith(cardLast4) || cardLast4.endsWith(tLast4));
      const isCardSpend = (t.instrument === 'Credit Card') || bankMatches;

      if (last4Matches || (bankMatches && isCardSpend)) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'debit') {
          currentCycleSpend += amt;
          cycleDebitCount++;
        } else if (t.type === 'credit') {
          currentCycleSpend = Math.max(0, currentCycleSpend - amt);
        }
      }
    }
  }

  const limit = Number(card.limit) || 100000;
  const utilizationPercent = Math.min(100, Math.round((currentCycleSpend / limit) * 1000) / 10);
  const availableLimit = Math.max(0, limit - currentCycleSpend);

  let utilizationStatus = 'optimal'; // < 20%
  if (utilizationPercent > 30) {
    utilizationStatus = 'high'; // > 30% alert
  } else if (utilizationPercent >= 20) {
    utilizationStatus = 'moderate'; // 20-30%
  }

  return {
    limit,
    currentCycleSpend: Math.round(currentCycleSpend),
    availableLimit: Math.round(availableLimit),
    utilizationPercent,
    utilizationStatus,
    cycleDebitCount,
  };
}

/**
 * Recommends the best card for a big transaction as of the specified date
 */
function recommendCard(cardsWithMetrics, asOfDate) {
  const { day } = parseDateParts(asOfDate);

  // Check if today is a statement day for any card
  const statementTodayCards = cardsWithMetrics.filter(c => c.cycle.cycleStatus === 'statement_day');
  
  // Sort candidate cards for spending
  const scored = [...cardsWithMetrics].sort((a, b) => {
    // 1. Never recommend a card on its statement day
    if (a.cycle.cycleStatus === 'statement_day') return 1;
    if (b.cycle.cycleStatus === 'statement_day') return -1;

    // 2. Deprioritize cards near their statement date (avoid closing bills)
    if (a.cycle.cycleStatus === 'avoid' && b.cycle.cycleStatus !== 'avoid') return 1;
    if (b.cycle.cycleStatus === 'avoid' && a.cycle.cycleStatus !== 'avoid') return -1;

    // 3. Deprioritize high utilization (>30%)
    if (a.utilization.utilizationStatus === 'high' && b.utilization.utilizationStatus !== 'high') return 1;
    if (b.utilization.utilizationStatus === 'high' && a.utilization.utilizationStatus !== 'high') return -1;

    // 4. Prefer fresh cycles
    const statusScore = { fresh: 100, good: 70, normal: 40, avoid: 10, statement_day: 0 };
    const scoreDiff = (statusScore[b.cycle.cycleStatus] || 0) - (statusScore[a.cycle.cycleStatus] || 0);
    if (scoreDiff !== 0) return scoreDiff;

    // 5. Prefer maximum interest-free days
    if (b.cycle.interestFreeDays !== a.cycle.interestFreeDays) {
      return b.cycle.interestFreeDays - a.cycle.interestFreeDays;
    }

    // 6. Prefer lower utilization
    return a.utilization.utilizationPercent - b.utilization.utilizationPercent;
  });

  const topCard = scored[0];
  const useUpi = statementTodayCards.length > 0 && statementTodayCards.some(c => c.id === topCard?.id);

  let recommendationReason = '';
  if (topCard) {
    recommendationReason = `${topCard.name} statement generated on ${topCard.statementDay}th (${topCard.cycle.daysSinceStatement} days ago). You get ~${topCard.cycle.interestFreeDays} days to repay (due ${topCard.cycle.nextDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}), with zero month-end bill shock.`;
  }

  return {
    topCard,
    scoredCards: scored,
    statementTodayCards,
    useUpiBufferToday: statementTodayCards.length > 0,
    recommendationReason,
  };
}

/**
 * Generates the monthly calendar view matching the reference September 2026 sheet
 */
function generateMonthlyCalendar(cards, year, month, transactions = []) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const schedule = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dayOfWeek = curDate.getDay(); // 0 Sun, 1 Mon...

    // Analyze all cards for this specific date
    const dayCards = cards.map(c => {
      const cycle = getCardCycleInfo(c, curDate);
      return { ...c, cycle, utilization: { utilizationStatus: 'optimal', utilizationPercent: 0 } };
    });

    const rec = recommendCard(dayCards, curDate);
    const stmnts = dayCards.filter(c => c.statementDay === d);

    let displayCard = rec.topCard ? rec.topCard.name : 'UPI';
    let cardKey = rec.topCard ? rec.topCard.id : 'upi';
    let note = rec.topCard ? rec.topCard.cycle.statusBadge : 'Use as buffer';
    let isUpi = false;

    if (stmnts.length > 0) {
      isUpi = true;
      displayCard = 'UPI';
      cardKey = 'upi';
      note = `(${stmnts.map(s => s.name.replace(' Bank', '')).join(' + ')} statement)`;
    }

    schedule.push({
      day: d,
      date: curDate.toISOString().split('T')[0],
      dayOfWeek,
      displayCard,
      cardKey,
      note,
      isUpi,
      hasStatement: stmnts.length > 0,
      statementCards: stmnts.map(s => s.name),
      interestFreeDays: rec.topCard ? rec.topCard.cycle.interestFreeDays : 0,
      topCardId: rec.topCard ? rec.topCard.id : null,
    });
  }

  return schedule;
}

/**
 * Master optimizer analysis output
 */
function getOptimizerOverview(customCards, transactions, asOfDate = new Date()) {
  const cards = (customCards && customCards.length > 0) ? customCards : DEFAULT_CARDS;
  const { year, month, day, dateObj } = parseDateParts(asOfDate);

  const cardsWithMetrics = cards.map(c => {
    const cycle = getCardCycleInfo(c, dateObj);
    const utilization = calculateUtilization(c, transactions, cycle);
    return {
      ...c,
      cycle,
      utilization,
    };
  });

  const recommendation = recommendCard(cardsWithMetrics, dateObj);
  const calendar = generateMonthlyCalendar(cards, year, month, transactions);

  return {
    asOfDate: dateObj.toISOString(),
    asOfDay: day,
    monthName: dateObj.toLocaleString('en-US', { month: 'long' }),
    year,
    cards: cardsWithMetrics,
    recommendation,
    calendar,
  };
}

module.exports = {
  DEFAULT_CARDS,
  getCardCycleInfo,
  calculateUtilization,
  recommendCard,
  generateMonthlyCalendar,
  getOptimizerOverview,
};
