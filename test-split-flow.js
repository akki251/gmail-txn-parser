// Runs against a scratch copy of db.js's storage so it never touches your
// real db.json. Simulates: two transactions come in from Gmail, one gets
// split three ways, a friend partially settles up, another settles in full.

const fs = require('fs');
const path = require('path');

const REAL_DB_PATH = path.join(__dirname, 'db.json');
const BACKUP_DB_PATH = path.join(__dirname, 'db.json.bak');
if (fs.existsSync(REAL_DB_PATH)) fs.renameSync(REAL_DB_PATH, BACKUP_DB_PATH);

// db.js also writes pipelineStats.json as a side effect of every ingest —
// protect the real one the same way, so running this test never pollutes
// real operational metrics.
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

// Deterministic regardless of the shell's real environment — the matching
// engine's Level 4 (AI) is gated on OPENROUTER_API_KEY being set, so fix
// it to a known test value rather than depending on whatever happens (or
// doesn't) to be exported in the environment this test runs in.
process.env.OPENROUTER_API_KEY = 'test-key-not-real';

// Fake out both LLM calls so tests are deterministic and don't hit the
// real OpenRouter API — swapped via Node's require cache, no mocking
// library needed, consistent with this file's zero-mocking style.
let llmBehavior = null; // set per-test to a function(rawText) -> result or throw
let aiMatchBehavior = null; // set per-test to a function(source, candidate) -> {isMatch, confidence}; defaults to "not a match" so ambiguous-band tests stay deterministic unless a test opts in
require.cache[require.resolve('./llmFallback')] = {
  exports: {
    llmFallbackExtract: async (rawText) => {
      if (!llmBehavior) throw new Error('llmBehavior not set for this test');
      return llmBehavior(rawText);
    },
    llmMatchTransactions: async (source, candidate) => {
      if (aiMatchBehavior) return aiMatchBehavior(source, candidate);
      return { isMatch: false, confidence: 0 };
    },
  },
};

(async () => {
try {
  const db = require('./db');
  let failures = 0;
  function check(label, cond) {
    console.log(`${cond ? '\u2713' : '\u2717'} ${label}`);
    if (!cond) failures++;
  }

  await db.upsertTransaction('msg1', {
    bank: 'SBI Card', amount: 1200, merchant: 'Toit Brewpub', type: 'debit', status: 'Approved', rawDate: '01-08-26',
  }, '2026-08-01T18:00:00Z');

  await db.upsertTransaction('msg2', {
    bank: 'ICICI Bank', amount: 850, merchant: null, type: 'credit', status: 'Approved', rawDate: '02-08-26',
  }, '2026-08-02T09:00:00Z');

  const reInserted = await db.upsertTransaction('msg1', { amount: 1200 }, '2026-08-01T18:00:00Z');
  check('duplicate messageId is ignored (idempotent)', reInserted === false);

  let unsplit = db.listUnsplit();
  check('unsplit list only contains debits', unsplit.every((t) => t.type === 'debit'));
  check('unsplit list has the SBI transaction', unsplit.some((t) => t.id === 'msg1'));

  const shares = db.splitTransaction('msg1', ['Rohan', 'Priya']);
  check('even split is \u20B9400 each', shares.Rohan === 400 && shares.Priya === 400);

  unsplit = db.listUnsplit();
  check('split transaction drops out of unsplit list', !unsplit.some((t) => t.id === 'msg1'));

  let ledger = db.ledger();
  check('ledger shows Rohan owes \u20B9400', ledger.Rohan === 400);
  check('ledger shows Priya owes \u20B9400', ledger.Priya === 400);

  db.settle('Rohan', 150);
  ledger = db.ledger();
  check('partial settle leaves \u20B9250 owed', ledger.Rohan === 250);

  db.settle('Priya');
  ledger = db.ledger();
  check('full settle clears Priya from the ledger', ledger.Priya === undefined);

  // Cross-source dedupe: same real payment can arrive via two channels
  // (e.g. bank email + bank SMS) with different message IDs.
  await db.upsertTransaction('email-1', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank', amount: 250, merchant: 'Test Merchant', type: 'debit', status: 'Approved', refNo: 'UPI999',
  }, '2026-08-05T10:00:00Z');

  const smsRefDup = await db.upsertTransaction('sms-1', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 250, merchant: 'Test Merchant', type: 'debit', status: 'Approved', refNo: 'UPI999',
  }, '2026-08-05T10:00:15Z');
  check('same refNo across sources is treated as duplicate (not inserted)', smsRefDup === false);

  // Isolated fixture (own amount) so this doesn't interact with email-1's
  // already-attached sms source above — each sub-scenario below tests one
  // thing in isolation rather than chaining off shared mutable state.
  await db.upsertTransaction('email-2', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank', amount: 251, merchant: 'Test Merchant', type: 'debit', status: 'Approved',
  }, '2026-08-05T10:00:00Z');
  const smsTimeDup = await db.upsertTransaction('sms-2', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 251, merchant: 'Test Merchant', type: 'debit', status: 'Approved',
  }, '2026-08-05T10:02:00Z');
  check('same bank/amount/type within window (no refNo), cross-channel, is treated as duplicate', smsTimeDup === false);

  // No merchant on either side here (deliberately) — with a merchant match
  // present, a 20 min cross-channel gap scores high enough to legitimately
  // auto-merge (a same-merchant SMS+email 20 min apart is plausibly one
  // real payment); without merchant, amount+bank+time alone land in the
  // ambiguous band, where the mocked AI (defaulting to "no match") decides.
  await db.upsertTransaction('email-3', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank', amount: 252, type: 'debit', status: 'Approved',
  }, '2026-08-05T10:00:00Z');
  const genuinelyDifferent = await db.upsertTransaction('sms-3', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 252, type: 'debit', status: 'Approved',
  }, '2026-08-05T10:20:00Z');
  check('same bank/amount, no merchant, 20 min gap, cross-channel -> ambiguous, AI mock says no -> NOT a duplicate', genuinelyDifferent === true);

  const differentAmount = await db.upsertTransaction('sms-4', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 99, merchant: 'Test Merchant', type: 'debit', status: 'Approved',
  }, '2026-08-05T10:00:30Z');
  check('same time window but different amount is NOT a duplicate', differentAmount === true);

  // The exact scenario from before: a second SMS arriving for a
  // transaction that ALREADY has one SMS + one email source attached —
  // same channel as the existing SMS source, so (per the same-channel
  // exclusion) this stays unmatched rather than assumed to be the same
  // payment a third time.
  const thirdSameChannel = await db.upsertTransaction('sms-1b', {
    bank: 'ICICI Bank', sourceParser: 'ICICI Bank SMS', amount: 250, merchant: 'Test Merchant', type: 'debit', status: 'Approved',
  }, '2026-08-05T10:00:20Z');
  check('a second SMS for an already sms+email-matched transaction is NOT auto-merged (same channel already represented)', thirdSameChannel === true);

  // Needs-review: a message from a known sender whose regex + LLM fallback
  // both failed shouldn't vanish — it's stored flagged, excluded from
  // splitting, and can heal later via retryNeedsReview.
  await db.upsertTransaction('review-1', {
    needsReview: true, sourceParser: 'ICICI Bank SMS', rawText: 'garbled sms text',
    sender: 'ICICIT-S', lastFailureReason: 'quota exceeded',
  }, '2026-08-05T11:00:00Z');

  check('needs-review record is excluded from unsplit list', !db.listUnsplit().some((t) => t.id === 'review-1'));
  check('needs-review record shows up in listNeedsReview', db.listNeedsReview().some((t) => t.id === 'review-1'));

  let splitBlocked = false;
  try {
    db.splitTransaction('review-1', ['Rohan']);
  } catch (err) {
    splitBlocked = true;
  }
  check('splitting a needs-review record throws', splitBlocked);

  llmBehavior = () => { throw new Error('still rate-limited'); };
  const retryFailed = await db.retryNeedsReview('review-1');
  check('retry that still fails returns false, stays flagged', retryFailed === false);
  check('failed retry updates the failure reason', db.getTransaction('review-1').lastFailureReason === 'still rate-limited');

  llmBehavior = () => ({
    bank: 'ICICI Bank', instrument: 'Account', amount: 60, currency: 'INR',
    merchant: 'Some Cafe', type: 'debit', status: 'Approved', rawDate: '05-Aug-26',
  });
  const retryHealed = await db.retryNeedsReview('review-1');
  check('retry that succeeds returns true', retryHealed === true);
  const healedTxn = db.getTransaction('review-1');
  check('healed record clears needsReview and gets real fields', !healedTxn.needsReview && healedTxn.amount === 60);
  check('healed record now appears in unsplit list', db.listUnsplit().some((t) => t.id === 'review-1'));

  // Same-bank cross-source dedupe: a bank's email + SMS alert for the same
  // payment shouldn't both get stored.
  await db.upsertTransaction('bank-email-1', {
    bank: 'HDFC Bank', sourceParser: 'HDFC Bank', amount: 340, merchant: 'Some Cafe', type: 'debit', status: 'Approved',
  }, '2026-08-09T12:00:00Z');

  const smsSideDup = await db.upsertTransaction('bank-sms-1', {
    bank: 'HDFC Bank', sourceParser: 'HDFC Bank SMS', amount: 340, merchant: 'Some Cafe', type: 'debit', status: 'Approved',
  }, '2026-08-09T12:01:30Z'); // 90s later, same bank/amount/type, different channel
  check('SMS alert for the same payment already stored via email is deduped', smsSideDup === false);

  const differentBankSameAmount = await db.upsertTransaction('bank-other-1', {
    bank: 'Axis Bank', sourceParser: 'Axis Bank', amount: 340, merchant: 'Unrelated Store', type: 'debit', status: 'Approved',
  }, '2026-08-09T12:01:45Z');
  check('same-amount transaction from a different bank is NOT deduped', differentBankSameAmount === true);

  // Regression test for a real bug found by replaying actual historical
  // production data: two SAME-CHANNEL alerts (e.g. two emails) with the
  // same bank/amount/merchant a few minutes apart must NOT be merged —
  // that's very plausibly a declined card swipe retried shortly after,
  // not one transaction reported twice. Matching across channels is the
  // whole point of this feature; matching within the same channel is not.
  await db.upsertTransaction('declined-attempt-1', {
    bank: 'IndusInd Bank', sourceParser: 'IndusInd Credit Card', amount: 399, merchant: 'EPIC GAMES STORE', type: 'debit', status: 'Declined',
  }, '2026-08-14T18:35:00Z');
  const declinedRetry = await db.upsertTransaction('declined-attempt-2', {
    bank: 'IndusInd Bank', sourceParser: 'IndusInd Credit Card', amount: 399, merchant: 'EPIC GAMES STORE', type: 'debit', status: 'Declined',
  }, '2026-08-14T18:39:00Z'); // 4 min later, same channel (both email)
  check('same-channel retry (declined purchase retried minutes later) is NOT merged', declinedRetry === true);

  console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'}`);
  cleanupAndExit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error('Test crashed:', err);
  cleanupAndExit(1);
}
})();
