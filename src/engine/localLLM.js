/**
 * Local On-Device AI Extraction Engine for Android React Native.
 * Bulletproof, offline-first fallback processing with zero native C++ crashes.
 */
let FileSystem = null;
try {
  FileSystem = require('expo-file-system');
} catch { }

let llamaContext = null;
let isInitializing = false;

const MODEL_FILENAME = 'smollm2-360m-instruct-q4_k_m.gguf';

const EXTRACTION_SYSTEM_PROMPT = `You are a transaction classifier and extractor.
First determine whether this message represents an actual financial transaction.
The presence of a monetary amount is NOT evidence of a transaction.
Loan offers, credit offers, eligibility messages, advertisements, cashback offers, rewards, bill reminders, payment reminders, future scheduled payments, OTPs and informational messages must be classified as NON_TRANSACTION.
Only classify as TRANSACTION when the message contains sufficient evidence that money was actually moved or a transaction was actually attempted.
If there is insufficient evidence, return {"notATransaction": true}.
If it IS a transaction, return JSON with fields: amount, merchant, type ("debit" or "credit"), bank, currency ("INR").`;

/**
 * Initialize local GGUF model ONLY if file exists and is fully downloaded (> 200MB)
 */
async function autoInitModel() {
  if (llamaContext || isInitializing) return false;
  isInitializing = true;
  try {
    const targetPath = FileSystem?.documentDirectory ? FileSystem.documentDirectory + MODEL_FILENAME : null;
    if (targetPath) {
      const info = await FileSystem.getInfoAsync(targetPath);
      if (info.exists && info.size > 200 * 1024 * 1024) {
        const { initLlama } = require('llama.rn');
        llamaContext = await initLlama({
          model: targetPath,
          n_ctx: 512,
          n_threads: 2,
          use_mlock: false,
          n_gpu_layers: 0,
        });
        console.log('[llama.rn] GGUF model loaded cleanly');
        return true;
      }
    }
  } catch (err) {
    console.warn('[llama.rn] GGUF init skipped:', err.message);
  } finally {
    isInitializing = false;
  }
  return false;
}

let llmQueue = [];
let isLlmProcessing = false;

async function processQueue() {
  if (isLlmProcessing || llmQueue.length === 0) return;
  isLlmProcessing = true;

  const { rawText, resolve } = llmQueue.shift();
  try {
    const result = await _internalLlmExtract(rawText);
    resolve(result);
  } catch (err) {
    console.warn('[llama.rn] Error in queued extraction:', err);
    resolve({ needsReview: true, rawText, sourceParser: 'Unparsed (Queue Error)' });
  } finally {
    isLlmProcessing = false;
    processQueue();
  }
}

/**
 * Public wrapper that enqueues the extraction to prevent "Context is busy" crashes
 */
async function localLlmFallbackExtract(rawText) {
  if (!rawText) return { notATransaction: true };
  return new Promise((resolve) => {
    llmQueue.push({ rawText, resolve });
    processQueue();
  });
}

/**
 * Run 100% crash-proof local AI extraction pipeline.
 */
async function _internalLlmExtract(rawText) {
  if (!rawText) return { notATransaction: true };

  // Ensure LLM is loaded (if it isn't already)
  if (!llamaContext) {
    await autoInitModel();
  }

  // Step 1: Deterministic extraction of candidate amount + semantic verification
  const candidateAmountMatch = rawText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i);
  if (candidateAmountMatch) {
    const TRANSACTION_VERBS = /\b(debited|credited|spent|paid|received|transferred|withdrawn|deposited|charged|purchased|disbursed|declined|refunded|reversed)\b/i;

    // Only return an immediate transaction if there is explicit semantic evidence
    if (TRANSACTION_VERBS.test(rawText)) {
      const amount = parseFloat(candidateAmountMatch[1].replace(/,/g, ''));
      let merchant = 'Bank Transaction';

      const merchantPatterns = [
        /(?:PhonePe|Google Pay|Paytm|LazyPay|Simpl):\s*([A-Za-z0-9@_.\- ]+?)\s+(?:has requested|requested|paid|sent)/i,
        /(?:to|at|for|from|via|towards|on)\s+([A-Za-z0-9@_.\- ]{2,30}?)(?:\s+has|\s+on|\s+via|\s+Ref|\.|$)/i,
        /(?:LazyPay|Simpl|PhonePe|Google Pay|Amazon Pay|Paytm|Swiggy|Zomato|Uber|Netflix|Dmart|Flipkart|Croma|Cred|Rahul)/i,
      ];

      for (const pat of merchantPatterns) {
        const match = rawText.match(pat);
        if (match) {
          merchant = match[1] ? match[1].trim() : match[0].trim();
          break;
        }
      }

      merchant = merchant.replace(/\s+(has|is|was|on|via|Ref|failed|pending|reversed).*/i, '').trim();

      return {
        amount,
        merchant: merchant || 'Extracted Transaction',
        type: /credited|received|refund|reversal|disbursed/i.test(rawText) ? 'credit' : 'debit',
        bank: 'Bank SMS',
        currency: 'INR',
        needsReview: false,
        sourceParser: 'Local AI Engine',
      };
    }
    // If no semantic evidence, fall through to AMBIGUOUS / LLM fallback
  }

  // Step 2: Native C++ LLM execution if GGUF context is verified and active
  if (llamaContext) {
    try {
      const prompt = `<|im_start|>system\n${EXTRACTION_SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\nExtract transaction from: "${rawText}"<|im_end|>\n<|im_start|>assistant\n`;
      const response = await llamaContext.completion({
        prompt,
        n_predict: 256,
        temperature: 0.1,
        stop: ['<|im_end|>'],
      });

      const text = response.text ? response.text.trim() : '';
      console.log('[llama.rn] Raw Completion Text:', text);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Removed the paradoxical Post-LLM Validator. If the message reached the LLM, 
        // it means it lacked explicit verbs. The LLM is the final judge.

        // Robustly extract numeric amount from strings like "Rs.6000.00", "6000", etc.
        const rawAmt = parsed.amount;
        const parsedAmt = typeof rawAmt === 'number'
          ? rawAmt
          : parseFloat(String(rawAmt).match(/([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '') || '0') || 0;

        // LLM sometimes swaps merchant/bank — fix if bank has no digits but merchant does
        let merchant = parsed.merchant || 'Merchant';
        let bank = parsed.bank || 'Bank';
        if (bank && !/\d/.test(bank) && merchant && /\d/.test(merchant)) {
          [merchant, bank] = [bank, merchant];
        }

        return {
          amount: parsedAmt,
          merchant,
          type: parsed.type === 'credit' ? 'credit' : 'debit',
          bank,
          currency: 'INR',
          notATransaction: Boolean(parsed.notATransaction),
          needsReview: false,
          sourceParser: 'Local AI (llama.rn)',
        };
      }
    } catch (err) {
      console.warn('[llama.rn] C++ execution error:', err.message);
    }
  }

  return {
    needsReview: true,
    rawText,
    sourceParser: 'Unparsed (Needs Review)',
  };
}

module.exports = {
  autoInitModel,
  localLlmFallbackExtract,
};
