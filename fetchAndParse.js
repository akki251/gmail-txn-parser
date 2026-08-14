const { google } = require('googleapis');
const { authorize } = require('./auth');
const { parseTransactionEmail } = require('./bankParsers');
const { llmFallbackExtract } = require('./llmFallback');
const db = require('./db');

// Add more as you find more banks — same allowlist principle as bankParsers.js
const BANK_SENDERS = [
  'transactionalert@indusind.com',
  'onlinesbicard@sbicard.com',
  'alert@icici.bank.in',
  'customernotification@icici.bank.in',
  'alerts@hdfcbank.bank.in',
  'alerts@axis.bank.in',
];

function decodeBase64Url(data) {
  return Buffer.from(data, 'base64').toString('utf-8');
}

function extractBodies(payload) {
  let htmlBody = '';
  let plaintextBody = '';
  (function walk(part) {
    if (!part) return;
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      htmlBody += decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      plaintextBody += decodeBase64Url(part.body.data);
    }
    (part.parts || []).forEach(walk);
  })(payload);
  return { htmlBody, plaintextBody };
}

// Gmail's "From" header looks like `IndusInd Bank <transactionalert@indusind.com>`
// — pull the bare address out so it matches bankParsers.js's sender regexes.
function extractEmail(fromHeader) {
  const m = (fromHeader || '').match(/<([^>]+)>/);
  return m ? m[1] : fromHeader;
}

async function main() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  const pending = db.listNeedsReview();
  if (pending.length > 0) {
    console.log(`Retrying ${pending.length} transaction(s) flagged needs-review...`);
    for (const txn of pending) {
      const healed = await db.retryNeedsReview(txn.id);
      console.log(healed ? `  + healed: ${txn.id}` : `  - still failing: ${txn.id}`);
    }
    console.log('');
  }

  const senderQuery = BANK_SENDERS.map((s) => `from:${s}`).join(' OR ');
  const { data: list } = await gmail.users.messages.list({
    userId: 'me',
    q: `(${senderQuery}) newer_than:30d`,
    maxResults: 50,
  });

  const messages = list.messages || [];
  console.log(`Found ${messages.length} candidate messages from known bank senders.\n`);

  const results = [];
  for (const ref of messages) {
    // Already stored (either resolved, or still needs-review and just
    // retried above) — skip re-fetching/re-parsing it this run.
    if (db.getTransaction(ref.id)) continue;

    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' });
    const headers = msg.payload.headers || [];
    const fromHeader = (headers.find((h) => h.name === 'From') || {}).value || '';
    const sender = extractEmail(fromHeader);
    const { htmlBody, plaintextBody } = extractBodies(msg.payload);

    const isoDate = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null;

    let result = parseTransactionEmail({ sender, htmlBody, plaintextBody });
    if (!result || result.notATransaction) continue;

    if (result.needsLLMFallback) {
      try {
        const extracted = await llmFallbackExtract(result.rawText);
        if (extracted.notATransaction) continue;
        result = { ...extracted, sourceParser: result.sourceParser, needsLLMFallback: true };
      } catch (err) {
        console.log(`  [LLM fallback failed for message ${ref.id}]: ${err.message} — flagged for review, not dropped`);
        db.upsertTransaction(ref.id, {
          needsReview: true,
          sourceParser: result.sourceParser,
          rawText: result.rawText,
          sender,
          lastFailureReason: err.message,
        }, isoDate);
        continue;
      }
    }

    const inserted = db.upsertTransaction(ref.id, result, isoDate);
    if (!inserted) continue; // already ingested on a previous run — idempotent, skip quietly

    results.push(result);
    const amt = typeof result.amount === 'number' ? `\u20B9${result.amount}` : '?';
    console.log(`+ ${amt}  ${result.merchant || '(no merchant)'}  [${result.bank || result.sourceParser}]`);
  }

  console.log(`\nStored ${results.length} new transactions out of ${messages.length} candidate messages.`);
  console.log("Run `node cli.js unsplit` to see what's waiting to be split.");
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
