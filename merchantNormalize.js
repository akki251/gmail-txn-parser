/**
 * Normalizes a merchant name for cross-source matching only (e.g. "AMAZON",
 * "Amazon.in", "AMAZON INDIA" -> the same normalized form). Deliberately
 * dumb/deterministic — no AI, no fuzzy ML — this only needs to catch the
 * mechanical differences bank templates introduce (case, common legal
 * suffixes, domain suffixes, punctuation), not genuine spelling variance.
 */
const LEGAL_SUFFIX_RE = /\b(pvt\.?|private|ltd\.?|limited|llp|inc\.?|corp\.?|india)\b/gi;
const DOMAIN_SUFFIX_RE = /\.(in|com|co|org)\b/gi;

function normalizeMerchant(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(DOMAIN_SUFFIX_RE, '')
    .replace(LEGAL_SUFFIX_RE, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cheap token-overlap similarity (0-1), not edit-distance/ML — good enough
// to tell "swiggy" vs "swiggy" (1.0) from "swiggy" vs "zomato" (0) from
// "amazon pay" vs "amazon" (partial), without a new dependency.
function merchantSimilarity(a, b) {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

module.exports = { normalizeMerchant, merchantSimilarity };
