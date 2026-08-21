// End-to-end dedup/reconciliation tests against db.js directly (not just
// matchingEngine.js in isolation) — covers source preservation,
// idempotency, concurrency, and order-independence, on a scratch copy of
// storage that never touches your real db.json/pipelineStats.json.
const fs = require('fs');
const path = require('path');

const REAL_DB_PATH = path.join(__dirname, 'db.json');
const BACKUP_DB_PATH = path.join(__dirname, 'db.json.bak');
if (fs.existsSync(REAL_DB_PATH)) fs.renameSync(REAL_DB_PATH, BACKUP_DB_PATH);

const REAL_STATS_PATH = path.join(__dirname, 'pipelineStats.json');
const BACKUP_STATS_PATH = path.join(__dirname, 'pipelineStats.json.bak');
if (fs.existsSync(REAL_STATS_PATH)) fs.renameSync(REAL_STATS_PATH, BACKUP_STATS_PATH);

function cleanupAndExit(code) {
  if (fs.existsSync(REAL_DB_PATH)) fs.unlinkSync(REAL_DB_PATH);
  if (fs.existsSync(BACKUP_DB_PATH)) fs.renameSync(BACKUP_DB_PATH, REAL_DB_PATH);
  if (fs.existsSync(REAL_STATS_PATH)) fs.unlinkSync(REAL_STATS_PATH);
  if (fs.existsSync(BACKUP_STATS_PATH)) fs.renameSync(BACKUP_STATS_PATH, REAL_STATS_PATH);
  process.exit(code);
}

process.env.OPENROUTER_API_KEY = 'test-key-not-real';
// Delegating mock: db.js destructures { llmFallbackExtract, llmMatchTransactions }
// at import time, capturing direct references. To swap behaviour mid-test we
// make those references delegate through a mutable object whose properties
// we can replace later.
const mockLlm = {
  extract: async () => { throw new Error('not used in this test'); },
  match: async () => ({ isMatch: false, confidence: 0 }),
};
require.cache[require.resolve('./llmFallback')] = {
  exports: {
    llmFallbackExtract: async (...args) => mockLlm.extract(...args),
    llmMatchTransactions: async (...args) => mockLlm.match(...args),
  },
};

(async () => {
try {
  const db = require('./db');
  let failures = 0;
  function check(label, cond) {
    console.log(`${cond ? '✓' : '✗'} ${label}`);
    if (!cond) failures++;
  }

  // 1. SMS-only bank (OneCard) — single source, straightforward insert.
  const oneCardInserted = await db.upsertTransaction('onecard-sms-1', {
    bank: 'OneCard', sourceParser: 'OneCard SMS', amount: 189.01, currency: 'INR',
    merchant: 'Dominospizza', type: 'debit', status: 'Approved',
  }, '2026-08-14T08:00:00Z');
  check('SMS-only bank (OneCard) creates a new transaction', oneCardInserted === true);

  // 2. Email-only bank (SBI Card) — single source, straightforward insert.
  const sbiInserted = await db.upsertTransaction('sbi-email-1', {
    bank: 'SBI Card', sourceParser: 'SBI Card', amount: 510.90, currency: 'INR',
    merchant: 'JioRecharge', type: 'debit', status: 'Approved',
  }, '2026-08-14T08:05:00Z');
  check('Email-only bank (SBI Card) creates a new transaction', sbiInserted === true);

  // 3. SMS + email bank (ICICI), SMS arrives first, email for the same
  // payment arrives second -> attaches, stays ONE canonical transaction.
  await db.upsertTransaction('icici-sms-first', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 700, currency: 'INR',
    merchant: 'Cafe Coffee Day', type: 'debit', status: 'Approved',
  }, '2026-08-14T09:00:00Z');
  const emailAfterSms = await db.upsertTransaction('icici-email-second', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank', amount: 700, currency: 'INR',
    merchant: 'Cafe Coffee Day', type: 'debit', status: 'Approved',
  }, '2026-08-14T09:02:00Z');
  check('email arriving after SMS for the same payment attaches, not a new transaction', emailAfterSms === false);

  let txn = db.getTransaction('icici-sms-first');
  check('canonical transaction has both source messages recorded', txn.sources.length === 2);
  check('one source is sms, one is email', txn.sources.some((s) => s.sourceType === 'sms') && txn.sources.some((s) => s.sourceType === 'email'));
  check('attached source has a match method recorded', txn.sources.find((s) => s.id === 'icici-email-second').matchMethod === 'deterministic');
  check('original source has no match method (it was the first, nothing to match against)', txn.sources.find((s) => s.id === 'icici-sms-first').matchMethod === null);

  // 4. Same scenario, order reversed: email arrives FIRST, SMS second —
  // the matching engine must be order-independent.
  await db.upsertTransaction('icici-email-first', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank', amount: 450, currency: 'INR',
    merchant: 'Blue Tokai', type: 'debit', status: 'Approved',
  }, '2026-08-14T10:00:00Z');
  const smsAfterEmail = await db.upsertTransaction('icici-sms-second', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 450, currency: 'INR',
    merchant: 'Blue Tokai', type: 'debit', status: 'Approved',
  }, '2026-08-14T10:01:30Z');
  check('SMS arriving after email for the same payment attaches, not a new transaction', smsAfterEmail === false);
  txn = db.getTransaction('icici-email-first');
  check('order-independent: canonical transaction still has both sources', txn.sources.length === 2);

  // 5. Idempotent retry: the exact same source message id ingested twice
  // (e.g. Gmail push redelivery, or the iOS Shortcut retrying a failed POST).
  const firstIngest = await db.upsertTransaction('retry-test-1', {
    bank: 'HDFC Bank', sourceParser: 'HDFC Bank', amount: 1000, currency: 'INR',
    merchant: 'Amazon', type: 'debit', status: 'Approved',
  }, '2026-08-14T11:00:00Z');
  const secondIngest = await db.upsertTransaction('retry-test-1', {
    bank: 'HDFC Bank', sourceParser: 'HDFC Bank', amount: 1000, currency: 'INR',
    merchant: 'Amazon', type: 'debit', status: 'Approved',
  }, '2026-08-14T11:00:00Z');
  check('first ingest of a source message succeeds', firstIngest === true);
  check('re-ingesting the exact same source message id is idempotent (no duplicate)', secondIngest === false);
  check('idempotent retry did not create a second source record', db.getTransaction('retry-test-1').sources.length === 1);

  // 6. Concurrent ingestion: two DIFFERENT source messages fired without
  // awaiting between them (simulates the SMS webhook and a Gmail fetch
  // landing at the same moment) — both must be recorded correctly, no
  // lost write from the in-process write lock racing.
  const concurrentPromises = [
    db.upsertTransaction('concurrent-1', {
      bank: 'Axis Bank', sourceParser: 'Axis Bank', amount: 77, currency: 'INR',
      merchant: 'Store A', type: 'debit', status: 'Approved',
    }, '2026-08-14T12:00:00Z'),
    db.upsertTransaction('concurrent-2', {
      bank: 'IndusInd Bank', sourceParser: 'IndusInd Credit Card', amount: 88, currency: 'INR',
      merchant: 'Store B', type: 'debit', status: 'Approved',
    }, '2026-08-14T12:00:01Z'),
  ];
  const [c1, c2] = await Promise.all(concurrentPromises);
  check('first concurrent ingest succeeded', c1 === true);
  check('second concurrent ingest succeeded (not lost to a write race)', c2 === true);
  check('both concurrent transactions actually persisted', db.getTransaction('concurrent-1') !== null && db.getTransaction('concurrent-2') !== null);

  // 7. Reprocessing a historical source message (e.g. a backfill re-run)
  // must not create a duplicate transaction.
  const reprocessed = await db.upsertTransaction('onecard-sms-1', {
    bank: 'OneCard', sourceParser: 'OneCard SMS', amount: 189.01, currency: 'INR',
    merchant: 'Dominospizza', type: 'debit', status: 'Approved',
  }, '2026-08-14T08:00:00Z');
  check('reprocessing a historical source message does not create a duplicate', reprocessed === false);

  const stats = require('./pipelineStats').getStats();
  check('match attempts were recorded', stats.matchAttempts > 0);
  check('at least one deterministic cross-source match was recorded', stats.matchedByDeterministic >= 2);

  // 8. retryNeedsReview: an SMS arrives, regex misses, LLM fails →
  // needsReview placeholder. Then an email for the same payment arrives
  // and creates a separate transaction (because needsReview is excluded
  // from candidates). When retryNeedsReview later succeeds on the SMS,
  // it must merge into the existing email transaction — not leave a
  // permanent duplicate. (This is the exact bug that caused the live
  // ₹316 SWIGGY duplicate on the GCP VM.)
  const needsReviewId = 'hdfc-sms-needs-review';
  const emailMatchId = 'hdfc-email-316';

  // Step a: ingest SMS as needsReview (LLM failed, no structured fields)
  await db.upsertTransaction(needsReviewId, {
    needsReview: true,
    sourceParser: 'HDFC Bank SMS',
    rawText: 'Spent Rs.316 On HDFC Bank Card 6558 At SWIGGY FOOD On 2026-08-20:21:39:54',
    sender: 'HDFCBK-S',
  }, '2026-08-14T15:00:00Z');
  check('SMS needsReview placeholder was created', db.getTransaction(needsReviewId) !== null);

  // Step b: email for the same payment arrives (parses fine, but the SMS
  // is excluded from matching candidates because needsReview: true)
  const emailResult = await db.upsertTransaction(emailMatchId, {
    bank: 'HDFC Bank', sourceParser: 'HDFC Bank', amount: 316, currency: 'INR',
    merchant: 'SWIGGY FOOD', type: 'debit', status: 'Approved',
    instrument: 'Credit Card', last4: '6558',
  }, '2026-08-14T15:00:01Z');
  check('email for same payment created a new (unmerged) transaction', emailResult === true);

  // Step c: mock the LLM to return the correct extracted fields
  mockLlm.extract = async () => ({
    bank: 'HDFC Bank', amount: 316, currency: 'INR', merchant: 'SWIGGY FOOD',
    type: 'debit', status: 'Approved', instrument: 'Credit Card', last4: '6558', refNo: null,
  });

  // Step d: retryNeedsReview should now merge the SMS into the email txn
  const healed = await db.retryNeedsReview(needsReviewId);
  check('retryNeedsReview succeeded', healed === true);
  check('needsReview placeholder was deleted (merged, not standalone)', db.getTransaction(needsReviewId) === null);
  const emailTxn = db.getTransaction(emailMatchId);
  check('email transaction now has both sources', emailTxn !== null && emailTxn.sources.length === 2);
  check('merged source includes the SMS id', emailTxn !== null && emailTxn.sources.some((s) => s.id === needsReviewId));

  // Restore the mock to the non-functional version
  mockLlm.extract = async () => { throw new Error('not used in this test'); };

  console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'}`);
  cleanupAndExit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error('Test crashed:', err);
  cleanupAndExit(1);
}
})();
