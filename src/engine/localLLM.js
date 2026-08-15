/**
 * Local On-Device LLM Inference Wrapper using `llama.rn` (llama.cpp C++ OpenCL bindings).
 * Runs SmolLM2-360M or Qwen2.5-0.5B GGUF models directly on Android CPU/GPU offline.
 */
let llamaContext = null;

const EXTRACTION_SYSTEM_PROMPT = `You are a financial transaction extraction assistant.
Given a bank SMS message text, extract the transaction details and return ONLY a valid JSON object with the following fields:
- "amount": numeric value of transaction
- "merchant": name of merchant or recipient (null if unknown)
- "type": "debit" or "credit"
- "bank": name of bank or issuer
- "currency": "INR"
- "notATransaction": boolean (true if SMS is OTP, login alert, or non-financial)

Do not include any explanation or markdown formatting, return ONLY the raw JSON object.`;

/**
 * Initialize local llama.rn context with a downloaded/bundled .gguf model file.
 */
async function initLocalModel(modelPath) {
  try {
    // Dynamically import llama.rn native module in React Native environment
    const { initLlama } = require('llama.rn');
    llamaContext = await initLlama({
      model: modelPath,
      n_ctx: 1024,
      n_threads: 4,
      use_mlock: true,
      n_gpu_layers: 99, // Enable OpenCL GPU acceleration when available
    });
    console.log('[llama.rn] Local LLM model initialized successfully:', modelPath);
    return true;
  } catch (err) {
    console.warn('[llama.rn] Could not initialize native C++ LLM context (falling back to mock/offline fallback):', err.message);
    return false;
  }
}

/**
 * Run local LLM inference to extract transaction details from raw SMS text.
 */
async function localLlmFallbackExtract(rawText) {
  if (!rawText) return { notATransaction: true };

  const prompt = `<|im_start|>system\n${EXTRACTION_SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\nExtract transaction from: "${rawText}"<|im_end|>\n<|im_start|>assistant\n`;

  if (llamaContext) {
    try {
      const response = await llamaContext.completion({
        prompt,
        n_predict: 128,
        temperature: 0.1,
        stop: ['<|im_end|>', '```'],
      });

      const text = response.text ? response.text.trim() : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || 0,
          merchant: parsed.merchant || null,
          type: parsed.type === 'credit' ? 'credit' : 'debit',
          bank: parsed.bank || 'Bank',
          currency: parsed.currency || 'INR',
          notATransaction: Boolean(parsed.notATransaction),
          sourceParser: 'Local AI (llama.rn)',
        };
      }
    } catch (err) {
      console.error('[llama.rn] Extraction error:', err);
    }
  }

  // Smart local heuristic fallback when GGUF model context is not loaded
  const amountMatch = rawText.match(/(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    let merchant = 'Bank Transaction';
    if (/LazyPay/i.test(rawText)) merchant = 'LazyPay';
    else if (/Axio/i.test(rawText)) merchant = 'Axio Pay Later';
    else {
      const atMatch = rawText.match(/(?:at|to|using)\s+([A-Za-z0-9\s]+?)(?:\s+on|\.|$)/i);
      if (atMatch) merchant = atMatch[1].trim();
    }

    return {
      amount,
      merchant,
      type: /credited|received/i.test(rawText) ? 'credit' : 'debit',
      bank: 'Bank SMS',
      currency: 'INR',
      needsReview: false,
      sourceParser: 'Local AI Fallback',
    };
  }

  return {
    needsReview: true,
    rawText,
    sourceParser: 'Unparsed (Needs Review)',
  };
}

module.exports = {
  initLocalModel,
  localLlmFallbackExtract,
};
