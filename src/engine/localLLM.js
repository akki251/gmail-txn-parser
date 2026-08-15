let FileSystem = null;
try {
  FileSystem = require('expo-file-system');
} catch {}

let llamaContext = null;
let isInitializing = false;

const MODEL_URL = 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf';
const MODEL_FILENAME = 'smollm2-360m-instruct-q4_k_m.gguf';

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
 * Download and initialize local llama.rn context with SmolLM2-360M GGUF model.
 */
async function autoInitModel(onProgress) {
  if (llamaContext) return true;
  if (isInitializing) return false;

  isInitializing = true;
  try {
    const targetPath = FileSystem.documentDirectory ? FileSystem.documentDirectory + MODEL_FILENAME : null;
    if (targetPath) {
      const info = await FileSystem.getInfoAsync(targetPath);
      if (!info.exists) {
        console.log('[llama.rn] Downloading SmolLM2-360M GGUF model weight from HuggingFace...');
        const downloadResumable = FileSystem.createDownloadResumable(
          MODEL_URL,
          targetPath,
          {},
          (progress) => {
            const ratio = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(ratio);
          }
        );
        await downloadResumable.downloadAsync();
      }
      return await initLocalModel(targetPath);
    }
  } catch (err) {
    console.warn('[llama.rn] Auto model init warning:', err.message);
  } finally {
    isInitializing = false;
  }
  return false;
}

/**
 * Initialize local llama.rn context with a downloaded/bundled .gguf model file.
 */
async function initLocalModel(modelPath) {
  try {
    if (!modelPath) return false;
    const { initLlama } = require('llama.rn');
    llamaContext = await initLlama({
      model: modelPath,
      n_ctx: 512,
      n_threads: 2,
      use_mlock: false,
      n_gpu_layers: 0, // Safe CPU execution on Android emulators
    });
    console.log('[llama.rn] Local LLM model initialized successfully:', modelPath);
    return true;
  } catch (err) {
    console.warn('[llama.rn] Native C++ LLM context init warning:', err.message);
    return false;
  }
}

/**
 * Run local LLM inference to extract transaction details from raw SMS text.
 */
async function localLlmFallbackExtract(rawText) {
  if (!rawText) return { notATransaction: true };

  try {
    // Attempt auto-initialization if model context is not yet loaded
    if (!llamaContext) {
      await autoInitModel();
    }

    const prompt = `<|im_start|>system\n${EXTRACTION_SYSTEM_PROMPT}<|im_end|>\n<|im_start|>user\nExtract transaction from: "${rawText}"<|im_end|>\n<|im_start|>assistant\n`;

    if (llamaContext) {
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
          needsReview: false,
          sourceParser: 'Local AI (llama.rn)',
        };
      }
    }
  } catch (err) {
    console.warn('[llama.rn] Execution error, falling back to local heuristic:', err.message);
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
  autoInitModel,
  initLocalModel,
  localLlmFallbackExtract,
};
