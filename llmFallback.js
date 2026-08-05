/**
 * Fallback extractor for when a known-bank sender matched, but our regex
 * didn't (bank changed their email template). Costs a tiny API call, but
 * only fires on the rare mismatch — not on every email.
 *
 * Requires GEMINI_API_KEY in the environment.
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: rawText }] }],
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Gemini API error');

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text response from model');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { llmFallbackExtract };
