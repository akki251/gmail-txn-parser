/**
 * Matching engine for reconciling multi-source alerts (SMS + Email).
 *
 * P0 Safety Principle:
 * For financial data, prefer keeping two transactions over incorrectly
 * merging two different transactions.
 */
const SCORE_AUTO_MERGE_THRESHOLD = 0.85;
const SCORE_AMBIGUOUS_FLOOR = 0.55;
const DETERMINISTIC_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const SIGNAL_WEIGHTS = {
  merchant: 0.5,
  lastFour: 0.25,
  timeProximity: 0.25,
};

function normalizeMerchant(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/^(RAZ\*|VIN\*|EPC\*|PAYTM\*|INF\*)/i, '')
    .replace(/\b(PVT\.?|PRIVATE|LTD\.?|LIMITED|LLP|INC\.?|CORP\.?|INDIA)\b/gi, '')
    .replace(/\.(IN|COM|CO|ORG)\b/gi, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function merchantSimilarity(m1, m2) {
  const norm1 = normalizeMerchant(m1);
  const norm2 = normalizeMerchant(m2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;
  const tokensA = new Set(norm1.split(' '));
  const tokensB = new Set(norm2.split(' '));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

function lastFourOf(record) {
  return record.last4 || record.account || null;
}

/**
 * P0 Safety Gate: Mandatory Identity Conflict Check.
 * If both records have known identity information and that information
 * conflicts, they must NEVER be merged automatically.
 */
function hasConflict(a, b) {
  if (!a || !b) return false;

  // 1. Conflicting reference numbers (both present and not equal)
  if (a.refNo && b.refNo && a.refNo !== b.refNo) {
    return true;
  }

  // 2. Conflicting last4 or account numbers (both present and not equal)
  const aLast4 = lastFourOf(a);
  const bLast4 = lastFourOf(b);
  if (aLast4 && bLast4 && aLast4 !== bLast4) {
    return true;
  }

  // 3. Conflicting transaction direction / type (debit vs credit)
  if (a.type && b.type && a.type !== b.type) {
    return true;
  }

  // 4. Conflicting bank
  if (a.bank && b.bank && a.bank !== b.bank) {
    return true;
  }

  // 5. Conflicting amount
  if (typeof a.amount === 'number' && typeof b.amount === 'number' && a.amount !== b.amount) {
    return true;
  }

  return false;
}

function passesHardFilters(source, candidate) {
  if (hasConflict(source, candidate)) return false;
  if (candidate.sourceTypes && candidate.sourceTypes.includes(source.sourceType)) return false;

  return (
    source.amount === candidate.amount &&
    source.type === candidate.type &&
    (!source.bank || !candidate.bank || source.bank === candidate.bank)
  );
}

function timeGapMs(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const msA = new Date(dateA).getTime();
  const msB = new Date(dateB).getTime();
  if (isNaN(msA) || isNaN(msB)) return null;
  return Math.abs(msA - msB);
}

function scoreCandidate(source, candidate, windowMs = 45 * 60 * 1000) {
  if (hasConflict(source, candidate)) return 0;
  if (!passesHardFilters(source, candidate)) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  if (source.merchant && candidate.merchant) {
    weightedSum += SIGNAL_WEIGHTS.merchant * merchantSimilarity(source.merchant, candidate.merchant);
    weightTotal += SIGNAL_WEIGHTS.merchant;
  }

  const sourceLast4 = lastFourOf(source);
  const candidateLast4 = lastFourOf(candidate);
  if (sourceLast4 && candidateLast4) {
    weightedSum += SIGNAL_WEIGHTS.lastFour * (sourceLast4 === candidateLast4 ? 1 : 0);
    weightTotal += SIGNAL_WEIGHTS.lastFour;
  }

  const gapMs = timeGapMs(source.date, candidate.date);
  if (gapMs !== null && gapMs <= windowMs) {
    const timeScore = Math.max(0, 1 - gapMs / windowMs);
    weightedSum += SIGNAL_WEIGHTS.timeProximity * timeScore;
    weightTotal += SIGNAL_WEIGHTS.timeProximity;
  }

  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

async function matchSource(source, candidates, aiMatchFn) {
  if (!source || !candidates || candidates.length === 0) return null;

  // Level 1: Deterministic reference match
  if (source.refNo) {
    const refMatch = candidates.find((c) => c.refNo && c.refNo === source.refNo);
    if (refMatch && !hasConflict(source, refMatch)) {
      return { matchedTransaction: refMatch, method: 'reference', confidence: 1.0 };
    }
  }

  const hardFiltered = candidates.filter((c) => passesHardFilters(source, c));
  if (hardFiltered.length === 0) return null;

  // Level 2: Deterministic exact merchant + amount match within tight window
  const deterministic = hardFiltered.find((c) => {
    if (!source.merchant || !c.merchant) return false;
    if (hasConflict(source, c)) return false;
    const gapMs = timeGapMs(source.date, c.date);
    const inWindow = gapMs === null || gapMs <= DETERMINISTIC_WINDOW_MS;
    return merchantSimilarity(source.merchant, c.merchant) === 1.0 && inWindow;
  });
  if (deterministic) return { matchedTransaction: deterministic, method: 'deterministic', confidence: 0.95 };

  // Level 3: Anchored weighted score
  // P0 Safety Rule: Fuzzy auto-merge requires an identity anchor (same last4 or compatible refNo)
  let best = null;
  for (const candidate of hardFiltered) {
    if (hasConflict(source, candidate)) continue;
    const score = scoreCandidate(source, candidate);
    if (!best || score > best.score) best = { candidate, score };
  }

  const sourceLast4 = lastFourOf(source);
  const bestCandidateLast4 = best ? lastFourOf(best.candidate) : null;
  const hasStrongAnchor = Boolean(
    (sourceLast4 && bestCandidateLast4 && sourceLast4 === bestCandidateLast4) ||
    (source.refNo && best?.candidate.refNo && source.refNo === best.candidate.refNo)
  );

  if (best && best.score >= SCORE_AUTO_MERGE_THRESHOLD && hasStrongAnchor) {
    return { matchedTransaction: best.candidate, method: 'score', confidence: best.score };
  }

  // Level 4: AI fallback for ambiguous band (0.55 - 0.85)
  if (best && best.score >= SCORE_AMBIGUOUS_FLOOR && aiMatchFn && !hasConflict(source, best.candidate)) {
    try {
      const aiResult = await aiMatchFn(source, best.candidate);
      if (aiResult && aiResult.isMatch) {
        return { matchedTransaction: best.candidate, method: 'ai', confidence: aiResult.confidence };
      }
    } catch {
      // Fallback to unmatched
    }
  }

  return null;
}

module.exports = {
  matchSource,
  scoreCandidate,
  passesHardFilters,
  hasConflict,
  lastFourOf,
  merchantSimilarity,
  normalizeMerchant,
  SCORE_AUTO_MERGE_THRESHOLD,
  SCORE_AMBIGUOUS_FLOOR,
};
