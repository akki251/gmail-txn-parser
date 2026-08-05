/**
 * Sketch of the endpoint Gmail's push notification (via Cloud Pub/Sub watch)
 * or a polling job would hit. Framework-agnostic pseudocode — drop into an
 * Express route, a Cloudflare Worker, or a Cloud Function as-is.
 *
 * Flow:
 *  1. Gmail notifies "something changed in this mailbox" (it does NOT send
 *     the email content — you fetch it yourself via the Gmail API).
 *  2. Fetch the new message(s) since the last historyId.
 *  3. Run parseTransactionEmail() -> regex path.
 *  4. If needsLLMFallback -> llmFallbackExtract() -> LLM path.
 *  5. If neither matches or notATransaction -> drop it.
 *  6. Dedupe on Gmail messageId (idempotency — Gmail can redeliver).
 *  7. Store the transaction, then surface the "split this?" prompt.
 */

const { parseTransactionEmail } = require('./bankParsers');
const { llmFallbackExtract } = require('./llmFallback');

async function handleNewMessage(gmailMessage, { db, gmailClient }) {
  // 0. Idempotency — Gmail push can redeliver the same history event.
  const alreadySeen = await db.transactions.findOne({ messageId: gmailMessage.id });
  if (alreadySeen) return;

  // 1. Fetch full content (search_threads/history only gives snippets).
  const full = await gmailClient.getMessage(gmailMessage.id); // { sender, htmlBody, plaintextBody, date }

  // 2. Try the fast regex path first.
  let result = parseTransactionEmail(full);
  if (!result) return; // not from a known bank sender — ignore

  // 3. Fall back to the LLM only when the known sender's template didn't match.
  if (result.needsLLMFallback) {
    const extracted = await llmFallbackExtract(result.rawText);
    if (extracted.notATransaction) return;
    result = { ...extracted, sourceParser: result.sourceParser, needsLLMFallback: true };
  }

  // 4. Skip declined transactions — no money moved, nothing to split.
  if (result.status === 'Declined') return;

  // 5. Persist + surface for the split prompt.
  await db.transactions.insert({
    messageId: gmailMessage.id,
    date: full.date,
    ...result,
    splitStatus: 'unsplit', // 'unsplit' | 'personal' | 'split'
  });

  // Your app polls/subscribes to `splitStatus: 'unsplit'` rows and shows
  // the "split this ₹X at <merchant> with...?" prompt (push notification
  // if native, or just visible on next app open if it's a PWA).
}

module.exports = { handleNewMessage };
