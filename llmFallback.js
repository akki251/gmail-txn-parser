/**
 * Fallback extractor for when a known-bank sender matched, but our regex
 * didn't (bank changed their email template). Costs a tiny API call, but
 * only fires on the rare mismatch — not on every email.
 *
 * Requires GROQ_API_KEY in the environment.
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

async function llmFallbackExtract(rawText) {
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
  if (!text) throw new Error('No text response from model');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { llmFallbackExtract };
