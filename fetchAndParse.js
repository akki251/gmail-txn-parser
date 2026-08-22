const { google } = require('googleapis');
const { authorize } = require('./auth');
const { parseTransactionEmail } = require('./bankParsers');
const { llmFallbackExtract } = require('./llmFallback');
const db = require('./db');
const stats = require('./pipelineStats');

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
  let messages = [];
  let pageToken;

  // Process all pages using nextPageToken to prevent silent email omissions
  do {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: `(${senderQuery}) newer_than:30d`,
      maxResults: 100,
      pageToken,
    });
    stats.recordEvent('pagesFetched');

    if (data.messages && data.messages.length > 0) {
      messages.push(...data.messages);
      for (let i = 0; i < data.messages.length; i++) {
        stats.recordEvent('messagesDiscovered');
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${messages.length} candidate messages from known bank senders across all pages.\n`);

  const results = [];
  for (const ref of messages) {
    // Already stored (either resolved, or still needs-review and just
    // retried above) — skip re-fetching/re-parsing it this run.
    if (db.getTransaction(ref.id)) continue;

    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' });
    stats.recordEvent('messagesFetched');

    const headers = msg.payload.headers || [];
    const fromHeader = (headers.find((h) => h.name === 'From') || {}).value || '';
    const subject = (headers.find((h) => h.name === 'Subject') || {}).value || '';
    const sender = extractEmail(fromHeader);
    const { htmlBody, plaintextBody } = extractBodies(msg.payload);

    const isoDate = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null;

    stats.recordEvent('emailProcessed');

    let result = parseTransactionEmail({ sender, subject, htmlBody, plaintextBody });
    if (!result) {
      stats.recordEvent('transactionsRejected');
      continue;
    }
    if (result.notATransaction) {
      stats.recordEvent('filteredNotTransaction');
      stats.recordEvent('transactionsRejected');
      continue;
    }

    stats.recordEvent('messagesParsed');

    if (result.needsLLMFallback) {
      stats.recordEvent('aiFallbackCalled');
      stats.recordUnmatchedTemplate(result.sourceParser, result.rawText);
      try {
        const extracted = await llmFallbackExtract(result.rawText);
        stats.recordEvent('aiFallbackSuccess');
        if (extracted.notATransaction) {
          stats.recordEvent('filteredNotTransaction');
          stats.recordEvent('transactionsRejected');
          continue;
        }
        result = { ...extracted, sourceParser: result.sourceParser, needsLLMFallback: true };
      } catch (err) {
        stats.recordEvent('aiFallbackFailure');
        stats.recordEvent('needsReview');
        console.log(`  [LLM fallback failed for message ${ref.id}]: ${err.message} — flagged for review, not dropped`);
        await db.upsertTransaction(ref.id, {
          needsReview: true,
          sourceParser: result.sourceParser,
          rawText: result.rawText,
          sender,
        }, isoDate);
        continue;
      }
    } else {
      stats.recordEvent('deterministicMatch');
    }

    const isNew = await db.upsertTransaction(ref.id, result, isoDate);
    if (isNew) {
      stats.recordEvent('transactionsProduced');
      console.log(`+ ₹${result.amount}  ${result.merchant || '(no merchant)'}  [${result.bank || result.sourceParser}]`);
      results.push(result);
    } else {
      stats.recordEvent('transactionsDeduplicated');
    }
  }

  console.log(`\nStored ${results.length} new transactions out of ${messages.length} candidate messages.`);
  console.log("Run `node cli.js unsplit` to see what's waiting to be split.");

  const s = stats.getStats();
  const processed = s.smsProcessed + s.emailProcessed;
  const aiRate = processed > 0 ? ((s.aiFallbackCalled / processed) * 100).toFixed(1) : '0.0';
  console.log(
    `\nPipeline stats (all-time): ${processed} processed, ${s.deterministicMatch} deterministic, ` +
    `${s.filteredNotTransaction} filtered (OTP/promo), ${s.aiFallbackCalled} AI calls (${aiRate}%), ` +
    `${s.needsReview} needsReview. Run \`node cli.js unmatched-templates\` to see recurring formats worth a regex.`
  );
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
