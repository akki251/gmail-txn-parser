// Runs against a scratch copy of pipelineStats.js's storage so it never
// touches your real pipelineStats.json.
const fs = require('fs');
const path = require('path');

const REAL_PATH = path.join(__dirname, 'pipelineStats.json');
const BACKUP_PATH = path.join(__dirname, 'pipelineStats.json.bak');
if (fs.existsSync(REAL_PATH)) fs.renameSync(REAL_PATH, BACKUP_PATH);

function cleanupAndExit(code) {
  if (fs.existsSync(REAL_PATH)) fs.unlinkSync(REAL_PATH);
  if (fs.existsSync(BACKUP_PATH)) fs.renameSync(BACKUP_PATH, REAL_PATH);
  process.exit(code);
}

try {
  const stats = require('./pipelineStats');
  let failures = 0;
  function check(label, cond) {
    console.log(`${cond ? '✓' : '✗'} ${label}`);
    if (!cond) failures++;
  }

  stats.recordEvent('smsProcessed');
  stats.recordEvent('smsProcessed');
  stats.recordEvent('deterministicMatch');
  stats.recordEvent('aiFallbackCalled');
  stats.recordEvent('aiFallbackSuccess');

  let s = stats.getStats();
  check('smsProcessed increments correctly', s.smsProcessed === 2);
  check('deterministicMatch increments correctly', s.deterministicMatch === 1);
  check('aiFallbackCalled increments correctly', s.aiFallbackCalled === 1);
  check('aiFallbackSuccess increments correctly', s.aiFallbackSuccess === 1);

  let threw = false;
  try {
    stats.recordEvent('notARealEvent');
  } catch {
    threw = true;
  }
  check('recording an unknown event type throws (fails loudly, not silently)', threw);

  // Two messages with the same shape (only digits differ) should collapse
  // into the same signature — that's what lets a recurring format surface
  // as a single high-count entry instead of N distinct one-off entries.
  stats.recordUnmatchedTemplate('ICICI Bank SMS', 'ICICI Bank Acct XX123 debited Rs 50.00 on 01-Jan-26 via NEFT');
  stats.recordUnmatchedTemplate('ICICI Bank SMS', 'ICICI Bank Acct XX456 debited Rs 999.00 on 02-Jan-26 via NEFT');
  stats.recordUnmatchedTemplate('OneCard SMS', 'Rs. 10.00 sent from OneCard on 03 Jan 2026 to Someone');

  s = stats.getStats();
  const templates = Object.values(s.unmatchedTemplates);
  check('same-shaped messages collapse into one template signature', templates.some((t) => t.count === 2));
  check('different sourceParser produces a distinct template entry', templates.some((t) => t.sourceParser === 'OneCard SMS' && t.count === 1));
  check('stored sample has digits redacted (no raw amounts/account numbers persisted)', templates.every((t) => !/\d/.test(t.sample)));

  stats.resetStats();
  s = stats.getStats();
  check('resetStats clears all counters', s.smsProcessed === 0 && Object.keys(s.unmatchedTemplates).length === 0);

  console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) FAILED.'}`);
  cleanupAndExit(failures === 0 ? 0 : 1);
} catch (err) {
  console.error('Test crashed:', err);
  cleanupAndExit(1);
}
