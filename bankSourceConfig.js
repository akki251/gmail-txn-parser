/**
 * Declares which channel(s) each bank's alerts are expected to arrive on.
 * Derived from which parser(s) actually exist AND actually produce real
 * transactions for that bank — not just which sender addresses are
 * allowlisted. ICICI's email allowlist (alert@icici.bank.in,
 * customernotification@icici.bank.in) exists only to catch non-transaction
 * notifications (e.g. app activation) via the notATransaction filter;
 * ICICI does not send real transaction alerts by email, only SMS — so it's
 * single-source like everything else in the current real data, despite
 * having both an email and an SMS parser registered.
 *
 * Purely descriptive: this tells the matching engine whether it's even
 * worth attempting cross-source matching for a given bank (skip it
 * entirely for a single-source bank) and how wide a reconciliation window
 * makes sense — it is NOT itself the matching mechanism. Matching two
 * source records is always matchingEngine.js's job, based on their actual
 * content, never a hardcoded "if bank === X" merge. If a bank that
 * genuinely sends both channels shows up later, only this config needs a
 * one-line update — no matching logic changes.
 */
const BANK_SOURCE_CONFIG = {
  'ICICI Bank': { supportedSources: ['sms'] },
  'IndusInd Bank': { supportedSources: ['email'] },
  'SBI Card': { supportedSources: ['email'] },
  'HDFC Bank': { supportedSources: ['email'] },
  'Axis Bank': { supportedSources: ['email'] },
  OneCard: { supportedSources: ['sms'] },
};

const DEFAULT_CONFIG = { supportedSources: ['sms', 'email'], reconciliationWindowMs: 45 * 60 * 1000 };

function getBankSourceConfig(bank) {
  return BANK_SOURCE_CONFIG[bank] || DEFAULT_CONFIG;
}

// Only banks configured for >1 source are worth attempting cross-source
// matching for — a cheap skip for the common single-source case.
function expectsCrossSourceMatch(bank) {
  return getBankSourceConfig(bank).supportedSources.length > 1;
}

module.exports = { BANK_SOURCE_CONFIG, getBankSourceConfig, expectsCrossSourceMatch };
