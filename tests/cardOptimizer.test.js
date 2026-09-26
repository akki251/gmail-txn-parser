// tests/cardOptimizer.test.js
const assert = require('assert');
const {
  DEFAULT_CARDS,
  getCardCycleInfo,
  calculateUtilization,
  recommendCard,
  generateMonthlyCalendar,
  getOptimizerOverview,
} = require('../cardOptimizer');

console.log('Testing cardOptimizer...');

// 1. Test ICICI recommendation on September 26, 2026
const dateSep26 = new Date(2026, 8, 26); // Sep 26, 2026
const overviewSep26 = getOptimizerOverview(DEFAULT_CARDS, [], dateSep26);

assert.strictEqual(overviewSep26.recommendation.topCard.id, 'icici', 'ICICI should be #1 on Sep 26');
assert.ok(overviewSep26.recommendation.topCard.cycle.interestFreeDays >= 40, 'Should have >= 40 days runway');
assert.strictEqual(overviewSep26.calendar.length, 30, 'September should have 30 days');

// 2. Test Indian Bank One on September 6, 2026 (right after statement on 5th)
const dateSep6 = new Date(2026, 8, 6);
const overviewSep6 = getOptimizerOverview(DEFAULT_CARDS, [], dateSep6);
assert.strictEqual(overviewSep6.recommendation.topCard.id, 'indian_bank', 'Indian Bank should be #1 on Sep 6');

// 3. Test Statement Day UPI warning on September 21, 2026 (ICICI statement day)
const dateSep21 = new Date(2026, 8, 21);
const day21 = overviewSep26.calendar.find(d => d.day === 21);
assert.strictEqual(day21.displayCard, 'UPI', 'Statement day 21 should recommend UPI');
assert.strictEqual(day21.hasStatement, true, 'Statement day 21 should flag statement');

// 4. Test Utilization Calculation and High Utilization Demotion
const sampleTxns = [
  {
    bank: 'ICICI Bank',
    instrument: 'Credit Card',
    last4: '3006',
    amount: 120000,
    type: 'debit',
    date: '2026-09-22T10:00:00.000Z',
  },
];

const iciciCard = DEFAULT_CARDS.find(c => c.id === 'icici');
const cycleInfo = getCardCycleInfo(iciciCard, dateSep26);
const utilInfo = calculateUtilization(iciciCard, sampleTxns, cycleInfo);

assert.strictEqual(utilInfo.currentCycleSpend, 120000, 'Spent should be 1,20,000');
assert.strictEqual(utilInfo.utilizationPercent, 40, 'Utilization should be 40% (120k / 300k)');
assert.strictEqual(utilInfo.utilizationStatus, 'high', 'Utilization > 30% should be high');

// If ICICI is high utilization (>30%), recommendation on Sep 26 should switch to runner-up (IndusInd)
const cardsWithHighUtil = DEFAULT_CARDS.map(c => {
  const cyc = getCardCycleInfo(c, dateSep26);
  const ut = calculateUtilization(c, sampleTxns, cyc);
  return { ...c, cycle: cyc, utilization: ut };
});

const recHigh = recommendCard(cardsWithHighUtil, dateSep26);
assert.strictEqual(recHigh.topCard.id, 'indusind', 'Should switch to IndusInd when ICICI is over 30% utilization');

console.log('All cardOptimizer tests passed successfully! ✅');
