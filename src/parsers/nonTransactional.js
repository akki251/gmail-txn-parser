/**
 * Cheap pre-filter for messages from a known bank sender that are
 * obviously not a transaction alert (OTP, login notification, password
 * reset, app activation, bill/statement reminders, etc.)
 */
const NON_TRANSACTIONAL_RE =
  /\b(OTP|one[- ]time password|logged in|password|verification code|pending payment request|payment request|requested you to pay|tap to pay|is pending|failed|declined|attempt.*could not be completed|cashback|is due on|due date|scheduled for auto-debit)\b|\bbill\b.{0,60}?\b(is ready|is generated|generated)\b|\bstatement\b.{0,60}?\b(generated|is ready)\b/i;
const COMPLETION_VERB_RE = /\b(debited|credited|spent|paid|withdrawn|purchase[d]?|sent|received|transferred)\b/i;

function isNonTransactional(text) {
  if (!text) return false;
  return NON_TRANSACTIONAL_RE.test(text) && !COMPLETION_VERB_RE.test(text);
}

module.exports = { isNonTransactional };
