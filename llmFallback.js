/**
 * Fallback extractor for when a known-bank sender matched, but our regex
 * didn't (bank changed their email template). Costs a tiny API call, but
 * only fires on the rare mismatch — not on every email.
 *
 * Tries Groq first (GROQ_API_KEY); if that call fails for any reason (bad
 * key, rate limit, outage), retries once against OpenRouter
 * (OPENROUTER_API_KEY) before giving up — so a single provider's downtime
 * doesn't push a real transaction into needsReview.
 */

const SYSTEM_PROMPT = `You extract structured transaction data from Indian bank/card transaction alert emails.
Output ONLY valid JSON, no preamble, no markdown fences, matching this shape exactly:
{
  "bank": string,
  "instrument": "Credit Card" | "Debit Card" | "Account" | "UPI" | null,
  "last4": string | null,
  "amount": number,
  "currency": "INR",
  "merchant": string | null,
  "type": "debit" | "credit",
  "status": "Approved" | "Declined" | "Pending",
  "rawDate": string | null
}
If the email is not actually a transaction alert (e.g. an offer, a statement reminder, a failed-payment notice with no real debit), output {"notATransaction": true} instead.`;

function parseModelJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function callGroq(rawText) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawText },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Groq API error');

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text response from Groq');

  return parseModelJson(text);
}

async function callOpenRouter(rawText) {
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
  if (!text) throw new Error('No text response from OpenRouter');

  return parseModelJson(text);
}

async function llmFallbackExtract(rawText) {
  try {
    return await callGroq(rawText);
  } catch (groqErr) {
    if (!process.env.OPENROUTER_API_KEY) throw groqErr;
    try {
      return await callOpenRouter(rawText);
    } catch (openRouterErr) {
      throw new Error(`Groq failed (${groqErr.message}); OpenRouter fallback also failed (${openRouterErr.message})`);
    }
  }
}

module.exports = { llmFallbackExtract };
