/**
 * Fallback extractor for when a known-bank sender matched, but our regex
 * didn't (bank changed their email template). Costs a tiny API call, but
 * only fires on the rare mismatch — not on every email.
 *
 * Requires OPENROUTER_API_KEY in the environment.
 */

const SYSTEM_PROMPT = `You are a strict transaction classifier and extractor.
First determine whether this message represents an actual financial transaction.
The presence of a monetary amount is NOT evidence of a transaction.
Loan offers, credit offers, eligibility messages, advertisements, cashback offers, rewards, bill reminders, payment reminders, future scheduled payments, OTPs and informational messages must be classified as NON_TRANSACTION.
Only classify as TRANSACTION when the message contains sufficient evidence that money was actually moved or a transaction was actually attempted.
If there is insufficient evidence or it's a NON_TRANSACTION, output ONLY: {"notATransaction": true}

If it IS a valid transaction, output ONLY valid JSON, no preamble, no markdown fences, matching this shape exactly:
{
  "bank": string,
  "instrument": "Credit Card" | "Debit Card" | "Account" | "UPI" | null,
  "last4": string | null,
  "amount": number,
  "currency": "INR",
  "merchant": string | null,
  "type": "debit" | "credit",
  "status": "Approved" | "Declined" | "Pending",
  "rawDate": string | null,
  "refNo": string | null
}`;

async function llmFallbackExtract(rawText) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawText },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter API error');

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text response from model');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

const MATCH_SYSTEM_PROMPT = `You decide whether two Indian bank transaction records (already-extracted structured fields, not raw messages) describe the SAME real-world payment, arriving via two different channels (e.g. SMS + email for the same transaction).
Output ONLY valid JSON, no preamble, no markdown fences: {"isMatch": boolean, "confidence": number between 0 and 1}.
Only say isMatch: true if you're confident they're the same payment. When genuinely unsure, prefer isMatch: false — a missed duplicate is far less costly than incorrectly merging two different real transactions.`;

// Deliberately takes only already-extracted structured fields (amount,
// merchant, last4, time gap), never raw SMS/email text — this is a last-
// resort arbitration for an already-ambiguous pair, not an extraction
// call, so there's no reason to send more than the minimum needed to
// decide "same payment or not".
async function llmMatchTransactions(source, candidate) {
  const gapMs = Math.abs(new Date(source.date).getTime() - new Date(candidate.date).getTime());
  const summary = JSON.stringify({
    recordA: { amount: source.amount, merchant: source.merchant, last4: source.last4 || source.account },
    recordB: { amount: candidate.amount, merchant: candidate.merchant, last4: candidate.last4 || candidate.account },
    timeGapMinutes: Math.round(gapMs / 60000),
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: MATCH_SYSTEM_PROMPT },
        { role: 'user', content: summary },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter API error');

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text response from model');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { llmFallbackExtract, llmMatchTransactions };
