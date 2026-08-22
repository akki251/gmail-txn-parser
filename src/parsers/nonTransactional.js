/**
 * Cheap pre-filter for messages from a known bank sender.
 *
 * P0 Safety Rule: Completed transaction evidence MUST beat negative /
 * administrative context or footers.
 *
 * Precedence:
 *   1. COMPLETED_TRANSACTION_RE -> NOT a non-transaction (false)
 *   2. FUTURE_RE -> non-transaction (true)
 *   3. FAILED_RE -> non-transaction (true)
 *   4. BILL_PAYMENT_RE -> non-transaction (true)
 *   5. NON_TRANSACTIONAL_RE -> non-transaction (true)
 *   6. Default -> false (pass to parsers / LLM)
 */

const COMPLETED_TRANSACTION_RE =
  /\b(debited|credited|spent|paid|withdrawn|purchased|purchase of|sent|received|transferred|disbursed|successfully\s+(?:paid|debited|credited)|transaction\s+amount)\b/i;

const NON_TRANSACTIONAL_RE =
  /\b(OTP|one[- ]time password|logged in|login (has been |was )?enabled|password|verification code|pending payment request|payment request|requested you to pay|tap to pay|is pending|failed|declined|attempt.*could not be completed|cashback|is due on|due date|scheduled for auto-debit|offer|loan|avail|credit limit|limit increase|apply now|upcoming|activat(ed|ion))\b|\bbill\b.{0,60}?\b(is ready|is generated|generated)\b|\bstatement\b.{0,60}?\b(generated|is ready)\b/i;

const FUTURE_RE = /\b(will be debited|is due|due on|due date|scheduled for|will be credited)\b/i;
const FAILED_RE = /\b(failed|declined|rejected|cancelled|cancel|not debited|no amount (was|has been) debited)\b/i;
const BILL_PAYMENT_RE = /\b(received payment|payment.*received|bill payment.*received)\b/i;

function hasCompletedMoneyMovement(text) {
  // Mask out future and negation phrases so "will be debited" or "not debited"
  // do not trigger false positive completion evidence.
  const withoutFutureOrNegated = text
    .replace(/\bwill\s+be\s+(?:debited|credited|paid|transferred)\b/gi, '')
    .replace(/\b(?:not|never|could\s+not\s+be|no\s+amount\s+(?:was|has\s+been))\s+(?:debited|credited|paid|transferred)\b/gi, '');

  return COMPLETED_TRANSACTION_RE.test(withoutFutureOrNegated);
}

function isNonTransactional(text) {
  if (!text) return false;

  // 1. Strong evidence of completed money movement wins over footer/unrelated text
  if (hasCompletedMoneyMovement(text)) {
    return false;
  }

  // 2. Pure future / scheduled notifications without completed money movement
  if (FUTURE_RE.test(text)) {
    return true;
  }

  // 3. Pure failure / decline notifications without completed money movement
  if (FAILED_RE.test(text)) {
    return true;
  }

  // 4. Bill payment confirmations
  if (BILL_PAYMENT_RE.test(text)) {
    return true;
  }

  // 5. OTP, login, or administrative noise
  if (NON_TRANSACTIONAL_RE.test(text)) {
    return true;
  }

  return false;
}

module.exports = {
  isNonTransactional,
  COMPLETED_TRANSACTION_RE,
  FUTURE_RE,
  FAILED_RE,
  NON_TRANSACTIONAL_RE,
  BILL_PAYMENT_RE,
};
