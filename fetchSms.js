const { execFileSync } = require('child_process');
const os = require('os');
const path = require('path');
const { parseTransactionSms } = require('./smsParsers');
const { llmFallbackExtract } = require('./llmFallback');
const db = require('./db');

const CHAT_DB = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

// Sender handles to pull from chat.db — SQL LIKE patterns, matched against
// handle.id. Add more as other banks that only alert by SMS turn up.
const SMS_SENDER_PATTERNS = ['%ICICI%', '%OneCrd%'];

// Apple's Core Data absolute time epoch (2001-01-01 00:00:00 UTC), in ms
// since the Unix epoch. message.date is nanoseconds since this point on
// modern macOS.
const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1);

function appleDateToIso(appleDateNs) {
  if (!appleDateNs) return null;
  return new Date(APPLE_EPOCH_MS + Number(appleDateNs) / 1e6).toISOString();
}

// Rich/formatted messages sometimes store the body only in attributedBody
// (a binary NSKeyedArchiver blob) with message.text left NULL. The real
// message text is reliably the longest printable run in the blob — a
// pragmatic heuristic, not a full archiver decode, but sufficient here.
function decodeAttributedBody(hex) {
  if (!hex) return null;
  const buf = Buffer.from(hex, 'hex');
  const text = buf.toString('latin1');
  const runs = text.match(/[\x20-\x7E]{15,}/g) || [];
  if (runs.length === 0) return null;
  return runs.reduce((longest, r) => (r.length > longest.length ? r : longest), '');
}

function queryMessages() {
  const whereClause = SMS_SENDER_PATTERNS.map((p) => `handle.id LIKE '${p}'`).join(' OR ');
  const query = `
    SELECT message.guid AS guid, message.date AS date, message.text AS text,
           hex(message.attributedBody) AS attrHex, handle.id AS sender
    FROM message JOIN handle ON message.handle_id = handle.ROWID
    WHERE (${whereClause}) AND message.is_from_me = 0
    ORDER BY message.date DESC
    LIMIT 100;
  `;
  const output = execFileSync('/usr/bin/sqlite3', ['-json', CHAT_DB, query], { encoding: 'utf-8' });
  return output.trim() ? JSON.parse(output) : [];
}

async function main() {
  const pending = db.listNeedsReview();
  if (pending.length > 0) {
    console.log(`Retrying ${pending.length} transaction(s) flagged needs-review...`);
    for (const txn of pending) {
      const healed = await db.retryNeedsReview(txn.id);
      console.log(healed ? `  + healed: ${txn.id}` : `  - still failing: ${txn.id}`);
    }
    console.log('');
  }

  const rows = queryMessages();
  console.log(`Found ${rows.length} candidate SMS messages from known bank senders.\n`);

  let stored = 0;
  for (const row of rows) {
    if (db.getTransaction(row.guid)) continue;

    const isoDate = appleDateToIso(row.date);
    const text = (row.text && row.text.trim()) || decodeAttributedBody(row.attrHex);
    if (!text) continue;

    let result = parseTransactionSms({ sender: row.sender, text });
    if (!result) continue;

    if (result.needsLLMFallback) {
      try {
        const extracted = await llmFallbackExtract(result.rawText);
        if (extracted.notATransaction) continue;
        result = { ...extracted, sourceParser: result.sourceParser, needsLLMFallback: true };
      } catch (err) {
        console.log(`  [LLM fallback failed for SMS ${row.guid}]: ${err.message} — flagged for review, not dropped`);
        db.upsertTransaction(row.guid, {
          needsReview: true,
          sourceParser: result.sourceParser,
          rawText: result.rawText,
          sender: row.sender,
          lastFailureReason: err.message,
        }, isoDate);
        continue;
      }
    }

    const inserted = db.upsertTransaction(row.guid, result, isoDate);
    if (!inserted) continue;
    stored++;
    const amt = typeof result.amount === 'number' ? `₹${result.amount}` : '?';
    console.log(`+ ${amt}  ${result.merchant || '(no merchant)'}  [${result.bank || result.sourceParser}]`);
  }

  console.log(`\nStored ${stored} new transactions out of ${rows.length} candidate messages.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
