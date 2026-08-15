/**
 * Matching engine for reconciling multi-source alerts (SMS + Email).
 */
const SCORE_AUTO_MERGE_THRESHOLD = 0.85;
const SCORE_AMBIGUOUS_FLOOR = 0.45;
const DETERMINISTIC_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function normalizeMerchant(name) {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/^(RAZ\*|VIN\*|EPC\*|PAYTM\*|INF\*)/i, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function merchantSimilarity(m1, m2) {
  const norm1 = normalizeMerchant(m1);
  const norm2 = normalizeMerchant(m2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
  return 0;
}

function passesHardFilters(source, candidate) {
  if (source.amount !== candidate.amount) return false;
  if (source.type !== candidate.type) return false;
  if (source.bank && candidate.bank && source.bank !== candidate.bank) return false;
  return true;
}

function scoreCandidate(source, candidate) {
  if (!passesHardFilters(source, candidate)) return 0;
  let score = 0.4; // Base score for matching amount, type, bank
  
  const mSim = merchantSimilarity(source.merchant, candidate.merchant);
  score += mSim * 0.4;

  if (source.last4 && candidate.last4 && source.last4 === candidate.last4) {
    score += 0.2;
  }
  return Math.min(score, 1.0);
}

async function matchSource(source, candidates, aiMatchFn) {
  if (!source || !candidates || candidates.length === 0) return null;

  // Level 1: Deterministic reference match
  if (source.refNo) {
    const refMatch = candidates.find((c) => c.refNo === source.refNo);
    if (refMatch) return { matchedTransaction: refMatch, method: 'reference', confidence: 1.0 };
  }

  // Level 2: Deterministic exact merchant + amount match
  const deterministic = candidates.find(
    (c) => passesHardFilters(source, c) && merchantSimilarity(source.merchant, c.merchant) === 1.0
  );
  if (deterministic) return { matchedTransaction: deterministic, method: 'deterministic', confidence: 0.95 };

  // Level 3: Weighted score
  let best = null;
  for (const candidate of candidates) {
    const score = scoreCandidate(source, candidate);
    if (!best || score > best.score) best = { candidate, score };
  }

  if (best && best.score >= SCORE_AUTO_MERGE_THRESHOLD) {
    return { matchedTransaction: best.candidate, method: 'score', confidence: best.score };
  }

  // Level 4: AI fallback for ambiguous band
  if (best && best.score >= SCORE_AMBIGUOUS_FLOOR && aiMatchFn) {
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

module.exports = { matchSource, scoreCandidate, passesHardFilters, SCORE_AUTO_MERGE_THRESHOLD, SCORE_AMBIGUOUS_FLOOR };
