const fs = require('fs');
const path = require('path');

// Auto-load .env file if present in project root
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
})();

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

const MATCH_SYSTEM_PROMPT = `You decide whether two Indian bank transaction records (already-extracted structured fields, not raw messages) describe the SAME real-world payment, arriving via two different channels (e.g. SMS + email for the same transaction).
Output ONLY valid JSON, no preamble, no markdown fences: {"isMatch": boolean, "confidence": number between 0 and 1}.
Only say isMatch: true if you're confident they're the same payment. When genuinely unsure, prefer isMatch: false — a missed duplicate is far less costly than incorrectly merging two different real transactions.`;

const VERIFY_SYSTEM_PROMPT = `You are a strict financial transaction verifier.
Your ONLY task is to determine whether the provided message represents an actual completed financial transaction (funds were debited, credited, spent, or withdrawn).
The presence of a monetary amount, merchant name, or bank name is NOT evidence of money movement.

Important Domain Rules:
1. UPI mandates, e-mandates, and autopay lifecycles:
   - Mandate setup, modification, pause, cancellation, or revocation (e.g., "mandate has been successfully revoked") are NOT transactions. The amount mentioned is an authorization limit, cap, or threshold, NOT settled money movement.
2. Payment requests, pre-authorization holds, upcoming bill reminders, OTPs, login alerts, and loan offers are NOT transactions.
3. Only classify as isTransaction: true when there is unambiguous evidence that funds actually moved (debited or credited).

Output ONLY valid JSON matching this schema:
{"isTransaction": boolean, "reason": string}`;

/**
 * Universal chat completion helper:
 * 1. Primary: Cerebras API (Fast inference)
 * 2. Fallback: OpenRouter API
 */
async function callChatCompletion({ messages, responseFormat = { type: 'json_object' } }) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  // 1. Try Cerebras as primary provider if configured
  if (cerebrasKey) {
    try {
      const cerebrasModels = ['qwen-3.8-27b', 'gpt-oss-120b', 'gemma-4-31b'];
      for (const model of cerebrasModels) {
        try {
          const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cerebrasKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              response_format: responseFormat,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (text) {
              const cleaned = text.replace(/```json|```/g, '').trim();
              return JSON.parse(cleaned);
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            console.warn(`[Cerebras ${model}] request failed (${response.status}):`, errData.message || response.statusText);
            // If billing/quota issue or auth error, don't keep looping Cerebras models
            if (response.status === 401 || response.status === 402 || response.status === 403) {
              break;
            }
          }
        } catch (innerErr) {
          console.warn(`[Cerebras ${model}] network error:`, innerErr.message);
        }
      }
    } catch (cerebrasErr) {
      console.warn('[Cerebras Primary Provider] error, falling back to OpenRouter:', cerebrasErr.message);
    }
  }

  // 2. Fallback to OpenRouter
  if (!openRouterKey) {
    throw new Error('Both Cerebras and OpenRouter are unavailable (missing OPENROUTER_API_KEY).');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterKey}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct',
      messages,
      response_format: responseFormat,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter API error');

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text response from OpenRouter model');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function llmFallbackExtract(rawText) {
  return callChatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ],
  });
}

async function llmMatchTransactions(source, candidate) {
  const gapMs = Math.abs(new Date(source.date).getTime() - new Date(candidate.date).getTime());
  const summary = JSON.stringify({
    recordA: { amount: source.amount, merchant: source.merchant, last4: source.last4 || source.account },
    recordB: { amount: candidate.amount, merchant: candidate.merchant, last4: candidate.last4 || candidate.account },
    timeGapMinutes: Math.round(gapMs / 60000),
  });

  return callChatCompletion({
    messages: [
      { role: 'system', content: MATCH_SYSTEM_PROMPT },
      { role: 'user', content: summary },
    ],
  });
}

async function llmVerifyTransaction(rawText) {
  if (!rawText || !rawText.trim()) return { isTransaction: false, reason: 'Empty text' };

  return callChatCompletion({
    messages: [
      { role: 'system', content: VERIFY_SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ],
  });
}

module.exports = {
  callChatCompletion,
  llmFallbackExtract,
  llmVerifyTransaction,
  llmMatchTransactions,
};


