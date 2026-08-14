/**
 * Cheap pre-filter for messages from a known bank sender that are
 * obviously not a transaction alert (OTP, login notification, password
 * reset, app activation, bill/statement reminders, etc.) — skipped
 * before regex parsing AND before the LLM fallback, so they don't burn
 * an LLM call for something that was never going to be a transaction.
 *
 * Gated on the ABSENCE of a completion verb (debited/credited/spent/...)
 * rather than the absence of an amount — a real OTP SMS often quotes the
 * transaction amount it's securing ("OTP for your transaction of INR
 * 799.00 is 573032") without money having actually moved yet, so amount
 * alone isn't a safe signal. A genuine debit/credit alert that happens to
 * also mention "OTP" still has a completion verb and safely falls
 * through to the normal parse path.
 */
const NON_TRANSACTIONAL_RE =
  /\b(OTP|one[- ]time password|logged in to|log in to|login (has been |was )?enabled|password (was |has been )?(reset|changed)|registration|verify your|verification code|activat(ed|ion))\b|\bbill\b.{0,60}?\bis ready\b|\bstatement\b.{0,60}?\b(generated|is ready)\b/i;
const COMPLETION_VERB_RE = /\b(debited|credited|spent|paid|withdrawn|purchase[d]?|sent|received|transferred)\b/i;

function isNonTransactional(text) {
  return NON_TRANSACTIONAL_RE.test(text) && !COMPLETION_VERB_RE.test(text);
}

module.exports = { isNonTransactional };
