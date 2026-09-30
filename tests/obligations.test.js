// tests/obligations.test.js
const assert = require('assert');
const {
  KNOWN_ENTITIES,
  analyzeCadence,
  analyzeAmounts,
  predictNextDate,
  parseObligationEmail,
  detectObligationsFromTransactions,
  fuseObligations,
  getObligationsOverview,
} = require('../obligationDetector');

console.log('Testing obligationDetector...');

// 1. Cadence analysis tests
const monthlyTxns = [
  { date: '2026-06-05T10:00:00Z', amount: 649 },
  { date: '2026-07-05T10:00:00Z', amount: 649 },
  { date: '2026-08-05T10:00:00Z', amount: 649 },
];
const monthlyCadence = analyzeCadence(monthlyTxns);
assert.strictEqual(monthlyCadence.frequency, 'Monthly', 'Should detect monthly cadence (~30 days)');
assert.strictEqual(monthlyCadence.isPeriodic, true);

// Semi-monthly cadence (e.g. 1st & 15th SIPs)
const semiMonthlyTxns = [
  { date: '2026-07-01T10:00:00Z', amount: 2500 },
  { date: '2026-07-16T10:00:00Z', amount: 2500 },
  { date: '2026-08-01T10:00:00Z', amount: 2500 },
  { date: '2026-08-16T10:00:00Z', amount: 2500 },
];
const semiMonthlyCadence = analyzeCadence(semiMonthlyTxns);
assert.strictEqual(semiMonthlyCadence.frequency, 'Semi-Monthly', 'Should detect semi-monthly cadence (~15 days)');

// Annual cadence (e.g. Term Insurance paid once a year)
const annualTxns = [
  { date: '2024-10-12T10:00:00Z', amount: 18450 },
  { date: '2025-10-12T10:00:00Z', amount: 18450 },
];
const annualCadence = analyzeCadence(annualTxns);
assert.strictEqual(annualCadence.frequency, 'Annual', 'Should detect annual cadence (~365 days)');

// 2. Amount stability and price change detection
const fixedAmounts = analyzeAmounts(monthlyTxns);
assert.strictEqual(fixedAmounts.isFixed, true, 'Netflix should be fixed amount');
assert.strictEqual(fixedAmounts.amountChanged, false, 'No price hike here');

const priceHikeTxns = [
  { date: '2026-06-05T10:00:00Z', amount: 499 },
  { date: '2026-07-05T10:00:00Z', amount: 499 },
  { date: '2026-08-05T10:00:00Z', amount: 649 }, // Hike!
];
const hikedStats = analyzeAmounts(priceHikeTxns);
assert.strictEqual(hikedStats.amountChanged, true, 'Should detect price hike');
assert.strictEqual(hikedStats.previousAmount, 499, 'Previous amount should be 499');
assert.strictEqual(hikedStats.amount, 649, 'Current amount should be 649');
assert.strictEqual(hikedStats.amountDiff, 150, 'Diff should be +150');

// Variable utility bill amounts
const utilityTxns = [
  { date: '2026-06-10T10:00:00Z', amount: 1250 },
  { date: '2026-07-10T10:00:00Z', amount: 1820 },
  { date: '2026-08-10T10:00:00Z', amount: 1540 },
];
const variableStats = analyzeAmounts(utilityTxns);
assert.strictEqual(variableStats.isFixed, false, 'Utility bill should be detected as variable');

// 3. Anti-Spam: Filter out ad-hoc retail merchants (Swiggy, Uber, Zomato)
const mixedTxns = [
  // Repeated Swiggy orders (should NOT become a subscription)
  { id: 'sw1', merchant: 'SWIGGY', amount: 450, type: 'debit', date: '2026-08-01T12:00:00Z' },
  { id: 'sw2', merchant: 'SWIGGY', amount: 890, type: 'debit', date: '2026-08-03T12:00:00Z' },
  { id: 'sw3', merchant: 'SWIGGY', amount: 320, type: 'debit', date: '2026-08-07T12:00:00Z' },
  // Genuine monthly subscription
  { id: 'nf1', merchant: 'Netflix', amount: 649, type: 'debit', date: '2026-07-15T12:00:00Z' },
  { id: 'nf2', merchant: 'Netflix', amount: 649, type: 'debit', date: '2026-08-15T12:00:00Z' },
  // Genuine monthly SIP
  { id: 'sip1', merchant: 'Nippon India Mutual Fund', amount: 5000, type: 'debit', date: '2026-07-01T09:00:00Z' },
  { id: 'sip2', merchant: 'Nippon India Mutual Fund', amount: 5000, type: 'debit', date: '2026-08-01T09:00:00Z' },
  // One-time investment (should not be marked as recurring SIP)
  { id: 'inv1', merchant: 'Groww Investments SIP', amount: 50000, type: 'debit', date: '2026-08-10T10:00:00Z' },
];

const asOfSep1 = new Date('2026-09-01T00:00:00Z');
const detected = detectObligationsFromTransactions(mixedTxns, asOfSep1);

// Verify Swiggy was ignored
const swiggyDetected = detected.find(o => /swiggy/i.test(o.merchant));
assert.strictEqual(swiggyDetected, undefined, 'Swiggy retail spends should NOT be treated as a subscription');

// Verify Netflix was detected
const netflixDetected = detected.find(o => o.key === 'netflix');
assert.ok(netflixDetected, 'Netflix should be detected');
assert.strictEqual(netflixDetected.category, 'Subscription');
assert.strictEqual(netflixDetected.amount, 649);
assert.strictEqual(netflixDetected.frequency, 'Monthly');
assert.strictEqual(netflixDetected.source, 'Transactions');
assert.strictEqual(netflixDetected.status, 'predicted');

// Verify Nippon SIP was detected
const nipponDetected = detected.find(o => o.key === 'nippon_mf');
assert.ok(nipponDetected, 'Nippon SIP should be detected');
assert.strictEqual(nipponDetected.category, 'SIP');
assert.strictEqual(nipponDetected.amount, 5000);
assert.strictEqual(nipponDetected.source, 'Bank/Investment data');

// 4. Email Notice Parser
const sampleInsuranceEmail = {
  subject: 'Renewal Notice: Your HDFC Life Term Insurance Policy No. 1928384 is due for renewal',
  body: 'Dear Customer, your annual premium of Rs. 18,450.00 is due on 12-Oct-2026. Please pay before due date to keep your life cover active.',
  date: '2026-09-20T10:00:00Z',
};
const parsedEmail = parseObligationEmail(sampleInsuranceEmail);
assert.ok(parsedEmail, 'Should parse insurance email notice');
assert.strictEqual(parsedEmail.merchant, 'HDFC Life Term Insurance');
assert.strictEqual(parsedEmail.amount, 18450);
assert.strictEqual(parsedEmail.category, 'Insurance');
assert.strictEqual(parsedEmail.frequency, 'Annual');
assert.strictEqual(new Date(parsedEmail.dueDate).getDate(), 12);
assert.strictEqual(new Date(parsedEmail.dueDate).getMonth(), 9); // October (0-indexed: 9)

// 5. Fusion: Prioritize email due dates & amounts over predictions and prevent double counting
const historicalInsuranceTxn = [
  { id: 'ins1', merchant: 'HDFC Life Insurance', amount: 17200, type: 'debit', date: '2025-10-15T10:00:00Z' },
];
const detectedWithInsurance = detectObligationsFromTransactions(historicalInsuranceTxn, asOfSep1);
const fused = fuseObligations(detectedWithInsurance, [parsedEmail], asOfSep1);

// Must have exactly ONE entry for HDFC Life (no double counting!)
const hdfcEntries = fused.filter(o => o.key === 'hdfc_life_term');
assert.strictEqual(hdfcEntries.length, 1, 'Should NOT double count HDFC Life');

const hdfcObligation = hdfcEntries[0];
assert.strictEqual(hdfcObligation.source, 'Email + history', 'Source should be Email + history');
assert.strictEqual(hdfcObligation.status, 'confirmed', 'Status should be confirmed from email notice');
assert.strictEqual(hdfcObligation.amount, 18450, 'Amount should take the explicit email amount 18,450 (prioritized)');
assert.strictEqual(hdfcObligation.amountChanged, true, 'Should detect amount changed from 17,200 to 18,450');
assert.strictEqual(new Date(hdfcObligation.expectedDate).getDate(), 12, 'Expected date should be exact 12th from email');
assert.strictEqual(hdfcObligation.confidence, 'High');

// 6. Complete Overview & Calendar Runway Test
const overview = getObligationsOverview(
  [...monthlyTxns.map((m, idx) => ({ id: `m_${idx}`, merchant: 'Netflix', amount: m.amount, type: 'debit', date: m.date })), ...historicalInsuranceTxn],
  [parsedEmail],
  {},
  new Date('2026-10-01T00:00:00Z')
);

assert.ok(overview.summary.totalActiveObligations >= 2, 'Should have active obligations');
assert.ok(overview.calendar.length >= 30, 'October should have 31 days in calendar');
const oct12CalendarDay = overview.calendar.find(d => d.day === 12);
assert.ok(oct12CalendarDay.hasObligation, 'October 12 should have HDFC Life obligation');
assert.strictEqual(oct12CalendarDay.totalAmount, 18450);

console.log('All obligationDetector tests passed successfully! ✅');
