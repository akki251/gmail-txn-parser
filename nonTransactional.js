/**
 * Cheap pre-filter for messages from a known bank sender that are
 * obviously not a transaction alert (OTP, login notification, password
 * reset, etc.) — skipped before regex parsing AND before the LLM
 * fallback, so they don't burn an LLM call for something that was never
 * going to be a transaction. Only fires when the text has no amount-like
 * pattern, so a real debit/credit alert that happens to mention "OTP"
 * (e.g. a card-verification OTP tied to a purchase) still falls through
 * to the normal parse path.
 */
const NON_TRANSACTIONAL_RE =
  /\b(OTP|one[- ]time password|logged in to|log in to|password (was |has been )?(reset|changed)|registration|verify your|verification code)\b/i;
const AMOUNT_RE = /\b(?:rs\.?|inr|₹)\s?[\d,]+(?:\.\d+)?\b/i;

function isNonTransactional(text) {
  return NON_TRANSACTIONAL_RE.test(text) && !AMOUNT_RE.test(text);
}

module.exports = { isNonTransactional };
