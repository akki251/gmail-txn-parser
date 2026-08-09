// Runs against a scratch copy of db.js's storage so it never touches your
// real db.json. Simulates: two transactions come in from Gmail, one gets
// split three ways, a friend partially settles up, another settles in full.

const fs = require('fs');
const path = require('path');

const REAL_DB_PATH = path.join(__dirname, 'db.json');
const BACKUP_PATH = path.join(__dirname, 'db.json.bak');
if (fs.existsSync(REAL_DB_PATH)) fs.renameSync(REAL_DB_PATH, BACKUP_PATH);

function cleanupAndExit(code) {
  if (fs.existsSync(REAL_DB_PATH)) fs.unlinkSync(REAL_DB_PATH);
  if (fs.existsSync(BACKUP_PATH)) fs.renameSync(BACKUP_PATH, REAL_DB_PATH);
  process.exit(code);
}

// Fake out the LLM call so retryNeedsReview tests are deterministic and
// don't hit the real Gemini API — swapped via Node's require cache, no
// mocking library needed, consistent with this file's zero-mocking style.
let llmBehavior = null; // set per-test to a function(rawText) -> result or throw
require.cache[require.resolve('./llmFallback')] = {
  exports: {
    llmFallbackExtract: async (rawText) => {
      if (!llmBehavior) throw new Error('llmBehavior not set for this test');
      return llmBehavior(rawText);
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

  db.upsertTransaction('msg1', {
    bank: 'SBI Card', amount: 1200, merchant: 'Toit Brewpub', type: 'debit', status: 'Approved', rawDate: '01-08-26',
  }, '2026-08-01T18:00:00Z');

  db.upsertTransaction('msg2', {
    bank: 'ICICI Bank', amount: 850, merchant: null, type: 'credit', status: 'Approved', rawDate: '02-08-26',
  }, '2026-08-02T09:00:00Z');

  const reInserted = db.upsertTransaction('msg1', { amount: 1200 }, '2026-08-01T18:00:00Z');
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
  db.upsertTransaction('email-1', {
    bank: 'ICICI Bank', amount: 250, type: 'debit', status: 'Approved', refNo: 'UPI999',
  }, '2026-08-05T10:00:00Z');

  const smsRefDup = db.upsertTransaction('sms-1', {
    bank: 'ICICI Bank', amount: 250, type: 'debit', status: 'Approved', refNo: 'UPI999',
  }, '2026-08-05T10:00:15Z');
  check('same refNo across sources is treated as duplicate (not inserted)', smsRefDup === false);

  const smsTimeDup = db.upsertTransaction('sms-2', {
    bank: 'ICICI Bank', amount: 250, type: 'debit', status: 'Approved',
  }, '2026-08-05T10:02:00Z');
  check('same bank/amount/type within 5 min (no refNo) is treated as duplicate', smsTimeDup === false);

  const genuinelyDifferent = db.upsertTransaction('sms-3', {
    bank: 'ICICI Bank', amount: 250, type: 'debit', status: 'Approved',
  }, '2026-08-05T10:20:00Z');
  check('same bank/amount but 20 min later is NOT a duplicate', genuinelyDifferent === true);

  const differentAmount = db.upsertTransaction('sms-4', {
    bank: 'ICICI Bank', amount: 99, type: 'debit', status: 'Approved',
  }, '2026-08-05T10:00:30Z');
  check('same time window but different amount is NOT a duplicate', differentAmount === true);

  // Needs-review: a message from a known sender whose regex + LLM fallback
  // both failed shouldn't vanish — it's stored flagged, excluded from
  // splitting, and can heal later via retryNeedsReview.
  db.upsertTransaction('review-1', {
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

  // Cross-type dedupe: a Swiggy order email and the bank's own alert for
  // the same order shouldn't both get stored. Order of arrival shouldn't
  // matter, and the brand-mention check should prevent an unrelated
  // same-amount/same-window transaction from false-matching.
  db.upsertTransaction('swiggy-1', {
    bank: 'Swiggy', sourceType: 'merchant', orderId: '999888777', amount: 340,
    merchant: 'Test Kitchen', type: 'debit', status: 'Approved',
  }, '2026-08-09T12:00:00Z');

  const bankSideDup = db.upsertTransaction('bank-1', {
    bank: 'HDFC Bank', amount: 340, merchant: 'SWIGGY PVT LTD FOOD2', type: 'debit', status: 'Approved',
  }, '2026-08-09T12:01:30Z');
  check('bank alert for the same Swiggy order (merchant-then-bank order) is deduped', bankSideDup === false);

  db.upsertTransaction('bank-2', {
    bank: 'ICICI Bank', amount: 500, merchant: 'SWIGGY FOOD', type: 'debit', status: 'Approved',
  }, '2026-08-09T13:00:00Z');

  const merchantSideDup = db.upsertTransaction('swiggy-2', {
    bank: 'Swiggy', sourceType: 'merchant', orderId: '111222333', amount: 500,
    merchant: 'Another Kitchen', type: 'debit', status: 'Approved',
  }, '2026-08-09T13:00:45Z');
  check('Swiggy order for the same payment (bank-then-merchant order) is deduped', merchantSideDup === false);

  const unrelatedStandalone = db.upsertTransaction('bank-3', {
    bank: 'Axis Bank', amount: 220, merchant: 'Some Store', type: 'debit', status: 'Approved',
  }, '2026-08-09T14:00:00Z');
  check('unrelated same-window bank transaction with no brand mention is NOT deduped', unrelatedStandalone === true);

  const standaloneSwiggy = db.upsertTransaction('swiggy-3', {
    bank: 'Swiggy', sourceType: 'merchant', orderId: '444555666', amount: 220,
    merchant: 'Wallet-Paid Kitchen', type: 'debit', status: 'Approved',
  }, '2026-08-09T14:00:20Z');
  check('Swiggy order with no matching bank record (unrelated bank-side match rejected) stays standalone', standaloneSwiggy === true);

  // Real-world-shaped gap: a delivery-notification email (e.g. "was
  // delivered") arrives well after payment, unlike a real-time payment
  // confirmation — verified live at ~21 minutes for a real order. The
  // wider 45-minute cross-type window exists specifically for this.
  db.upsertTransaction('bank-4', {
    bank: 'HDFC Bank', amount: 300, merchant: 'SWIGGY FOOD', type: 'debit', status: 'Approved',
  }, '2026-08-09T15:00:00Z');

  const delayedMerchantDup = db.upsertTransaction('swiggy-4', {
    bank: 'Swiggy', sourceType: 'merchant', orderId: '777888999', amount: 300,
    merchant: 'Slow Delivery Kitchen', type: 'debit', status: 'Approved',
  }, '2026-08-09T15:21:00Z'); // 21 min later
  check('delivery-notification-shaped 21 min gap still dedupes (within the 45 min cross-type window)', delayedMerchantDup === false);

  const tooLateMerchant = db.upsertTransaction('swiggy-5', {
    bank: 'Swiggy', sourceType: 'merchant', orderId: '000111222', amount: 300,
    merchant: 'Very Slow Kitchen', type: 'debit', status: 'Approved',
  }, '2026-08-09T15:50:00Z'); // 50 min after bank-4 — beyond the 45 min cap
  check('a gap beyond the 45 min cross-type window is NOT deduped', tooLateMerchant === true);

  console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'}`);
  cleanupAndExit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error('Test crashed:', err);
  cleanupAndExit(1);
}
})();
