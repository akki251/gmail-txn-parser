/**
 * Instrumentation for the parse pipeline: SMS/email -> pre-filter ->
 * deterministic parser -> (AI fallback if needed) -> stored/needsReview.
 * Purely additive — records counts so the AI-call cost and deterministic
 * hit-rate are actually visible, instead of assumed. Own JSON file
 * (not db.json) since this is operational metadata, not financial data.
 *
 * Also tracks "unmatched templates": when a known sender's message needed
 * the AI fallback, a redacted signature of that message (digits/amounts
 * stripped, so no PII/financial data persists) is counted. A signature
 * with a high count is a real, recurring format worth turning into a
 * proper regex + fixture — surfaced via `node cli.js unmatched-templates`,
 * never auto-converted into a parsing rule (this repo's real-fixture-only
 * rule means a human still writes and verifies that regex).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATS_PATH = path.join(__dirname, 'pipelineStats.json');

const EMPTY_STATS = {
  // Ingestion & Discovery metrics (P0 completeness tracking)
  pagesFetched: 0,
  messagesDiscovered: 0,
  messagesFetched: 0,
  messagesParsed: 0,
  transactionsProduced: 0,
  transactionsRejected: 0,
  transactionsDeduplicated: 0,

  // Channel processing counters
  smsProcessed: 0,
  emailProcessed: 0,
  filteredNotTransaction: 0,
  deterministicMatch: 0, // field-extraction: regex parsed cleanly, no AI needed
  aiFallbackCalled: 0,
  aiFallbackSuccess: 0,
  aiFallbackFailure: 0,
  needsReview: 0,

  // Cross-source dedup/matching (source message -> canonical transaction),
  // distinct from the field-extraction stats above.
  matchAttempts: 0,
  matchedByReference: 0,
  matchedByDeterministic: 0,
  matchedByScore: 0,
  matchedByAI: 0,
  unmatchedNew: 0, // no match found -> became its own new canonical transaction
  unmatchedTemplates: {}, // signature -> { count, sourceParser, sample }
};

function load() {
  if (!fs.existsSync(STATS_PATH)) return { ...EMPTY_STATS, unmatchedTemplates: {} };
  // Merge onto EMPTY_STATS so an older stats file (missing newer counters
  // added since it was last written) doesn't throw in recordEvent.
  const onDisk = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
  return { ...EMPTY_STATS, ...onDisk, unmatchedTemplates: onDisk.unmatchedTemplates || {} };
}

function save(stats) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

// Redacts digits/amounts so the stored signature carries no financial data
// or PII — just enough shape to tell "same template" from "different
// template" (e.g. two ICICI debit SMS with different amounts collapse to
// the same signature).
function templateSignature(text) {
  const redacted = text
    .replace(/\d+/g, '#') // collapse each digit run to one placeholder, so "50.00" and "999.00" redact identically
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return crypto.createHash('sha1').update(redacted).digest('hex').slice(0, 12);
}

function recordEvent(eventType) {
  const stats = load();
  if (!(eventType in stats) || typeof stats[eventType] !== 'number') {
    throw new Error(`Unknown pipeline stat event: ${eventType}`);
  }
  stats[eventType] += 1;
  save(stats);
}

function recordUnmatchedTemplate(sourceParser, rawText) {
  const stats = load();
  const signature = templateSignature(rawText);
  const key = `${sourceParser}:${signature}`;
  const existing = stats.unmatchedTemplates[key];
  if (existing) {
    existing.count += 1;
  } else {
    stats.unmatchedTemplates[key] = {
      count: 1,
      sourceParser,
      sample: rawText.replace(/\d/g, '#').slice(0, 300),
    };
  }
  save(stats);
}

function getStats() {
  return load();
}

function resetStats() {
  save({ ...EMPTY_STATS, unmatchedTemplates: {} });
}

module.exports = { recordEvent, recordUnmatchedTemplate, getStats, resetStats, templateSignature };
