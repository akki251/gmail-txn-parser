/**
 * Decides whether a newly-arrived source record (SMS or email) represents
 * the same real-world transaction as an already-stored canonical
 * transaction. Pure and synchronous except Level 4 (AI), which is
 * injected as `aiMatchFn` so this module is independently testable
 * without a network call or an API key.
 *
 * Hierarchy (cheapest/most-certain first, so most matches never reach the
 * next level):
 *   1. reference   - exact refNo match. confidence 1.0.
 *   2. deterministic - same bank+amount+type+merchant, tight window. 0.95.
 *   3. score        - weighted signals over a wider window. >=0.85 merge,
 *                     0.55-0.85 -> ambiguous (escalate to AI), <0.55 -> no match.
 *   4. ai           - only for the ambiguous score band.
 *
 * Hard filters (bank, amount, type must all match exactly) apply at every
 * level past reference — this is deliberate: two different amounts, or
 * two different banks, must NEVER merge, no matter how close in time or
 * how similar the merchant text is (see CLAUDE.md-equivalent rule for
 * this feature: false-positive merges are worse than a possible
 * unresolved duplicate).
 */
const { merchantSimilarity } = require('./merchantNormalize');
const { getBankSourceConfig } = require('./bankSourceConfig');

const DETERMINISTIC_WINDOW_MS = 10 * 60 * 1000;
const SCORE_AUTO_MERGE_THRESHOLD = 0.85;
const SCORE_AMBIGUOUS_FLOOR = 0.55;

const SIGNAL_WEIGHTS = {
  merchant: 0.5,
  lastFour: 0.25,
  timeProximity: 0.25,
};

function timeGapMs(dateA, dateB) {
  if (!dateA || !dateB) return null;
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime());
}

function passesHardFilters(source, candidate) {
  // A bank-assigned reference number is supposed to be unique per real
  // transaction — if BOTH sides have one and they differ, that's a strong
  // signal these are genuinely different payments, and must block a merge
  // even if amount/merchant/time otherwise align. (Level 1 already
  // handles the positive case: same refNo -> match, before this is ever
  // reached.)
  if (source.refNo && candidate.refNo && source.refNo !== candidate.refNo) return false;

  // The entire point of levels 2-3 is reconciling ONE real payment
  // reported via TWO DIFFERENT channels (SMS + email) — not deduping two
  // same-channel alerts. Two emails (or two SMS) with the same
  // bank/amount/merchant a few minutes apart are very plausibly two
  // genuinely separate real events: a declined card swipe retried
  // shortly after, or two small manual transfers of the same round
  // amount. Verified against real historical data: two such same-channel
  // pairs existed (a declined ₹399 purchase retried ~4 min later; two ₹1
  // test transfers ~5 min apart) and would have been incorrectly merged
  // without this check. So: only allow levels 2-3 to consider a candidate
  // that does NOT already have a source of this exact channel attached.
  if (candidate.sourceTypes && candidate.sourceTypes.includes(source.sourceType)) return false;

  return (
    source.bank === candidate.bank &&
    source.type === candidate.type &&
    typeof source.amount === 'number' &&
    source.amount === candidate.amount
  );
}

function lastFourOf(record) {
  return record.last4 || record.account || null;
}

function scoreCandidate(source, candidate, windowMs) {
  const gapMs = timeGapMs(source.date, candidate.date);
  if (gapMs === null || gapMs > windowMs) return 0;

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

  // Linear decay: 1.0 at zero gap, 0 at the edge of the window.
  const timeScore = Math.max(0, 1 - gapMs / windowMs);
  weightedSum += SIGNAL_WEIGHTS.timeProximity * timeScore;
  weightTotal += SIGNAL_WEIGHTS.timeProximity;

  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
}

// aiMatchFn(source, candidate) -> Promise<{isMatch: boolean, confidence: number}>
async function matchSource(source, candidateTransactions, aiMatchFn) {
  // Level 1: reference number.
  if (source.refNo) {
    const byRef = candidateTransactions.find((c) => c.refNo && c.refNo === source.refNo);
    if (byRef) return { matchedTransaction: byRef, method: 'reference', confidence: 1.0 };
  }

  const { reconciliationWindowMs = 45 * 60 * 1000 } = getBankSourceConfig(source.bank);
  const hardFiltered = candidateTransactions.filter((c) => passesHardFilters(source, c));
  if (hardFiltered.length === 0) return null;

  // Level 1.5: one side has a refNo, the other has null (e.g. LLM didn't extract it).
  // If bank+amount+type+last4 all agree within a tight window, treat as a reference match.
  // This handles: SMS fell to LLM (no refNo in output) + email had refNo from regex.
  if (source.refNo || hardFiltered.some(c => c.refNo)) {
    const refSideMatch = hardFiltered.find(c => {
      const oneHasRef = (source.refNo && !c.refNo) || (!source.refNo && c.refNo);
      if (!oneHasRef) return false;
      const sourceLast4 = lastFourOf(source);
      const cLast4 = lastFourOf(c);
      if (sourceLast4 && cLast4 && sourceLast4 !== cLast4) return false; // last4 mismatch = different card
      const gapMs = timeGapMs(source.date, c.date);
      return gapMs !== null && gapMs <= DETERMINISTIC_WINDOW_MS;
    });
    if (refSideMatch) return { matchedTransaction: refSideMatch, method: 'reference-partial', confidence: 0.92 };
  }

  // Level 2: deterministic — same bank/amount/type (already guaranteed by
  // the hard filter) plus an exact merchant match, in a tight window.
  const deterministic = hardFiltered.find((c) => {
    if (!source.merchant || !c.merchant) return false;
    const gapMs = timeGapMs(source.date, c.date);
    return (
      merchantSimilarity(source.merchant, c.merchant) === 1 &&
      gapMs !== null &&
      gapMs <= DETERMINISTIC_WINDOW_MS
    );
  });
  if (deterministic) return { matchedTransaction: deterministic, method: 'deterministic', confidence: 0.95 };

  // Level 3: weighted score across a wider, bank-configured window.
  let best = null;
  for (const candidate of hardFiltered) {
    const score = scoreCandidate(source, candidate, reconciliationWindowMs);
    if (!best || score > best.score) best = { candidate, score };
  }

  if (best && best.score >= SCORE_AUTO_MERGE_THRESHOLD) {
    return { matchedTransaction: best.candidate, method: 'score', confidence: best.score };
  }

  // Level 4: AI, only for the genuinely ambiguous band — never the
  // default parser, only a last resort when levels 1-3 can't decide. A
  // failed AI call must never break ingestion — it just means this
  // ambiguous pair stays unmatched (two separate transactions), same as
  // if no AI were configured at all.
  if (best && best.score >= SCORE_AMBIGUOUS_FLOOR && aiMatchFn) {
    try {
      const aiResult = await aiMatchFn(source, best.candidate);
      if (aiResult && aiResult.isMatch) {
        return { matchedTransaction: best.candidate, method: 'ai', confidence: aiResult.confidence };
      }
    } catch {
      // fall through to "no match"
    }
  }

  return null;
}

module.exports = { matchSource, scoreCandidate, passesHardFilters, SCORE_AUTO_MERGE_THRESHOLD, SCORE_AMBIGUOUS_FLOOR };
