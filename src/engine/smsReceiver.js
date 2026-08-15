/**
 * Native Android SMS Receiver & Ingestion Bridge for React Native Expo.
 * Listens for incoming SMS broadcasts, runs deterministic regex + local LLM fallback,
 * and saves transaction records to db.js so they instantly reflect on Dashboard.js.
 */
import { DeviceEventEmitter, NativeEventEmitter, NativeModules } from 'react-native';
import { parseTransactionSms } from '../parsers/smsParsers';
import { localLlmFallbackExtract } from './localLLM';
import db from '../store/db';

let listenerSubscription = null;

/**
 * Process an incoming raw SMS string (from BroadcastReceiver or manual mock)
 */
export async function processIncomingSms({ sender, text, date }) {
  if (!text) return null;

  console.log('[SMS Ingest Bridge] Processing incoming SMS:', { sender, text });

  // Step 1: Run deterministic regex parser
  let result = parseTransactionSms({ sender, text });

  // If sender is unknown or unparsed, wrap into a needsReview record
  if (!result) {
    result = {
      needsReview: true,
      needsLLMFallback: true,
      sourceParser: 'Unparsed Sender',
      rawText: text,
      sender: sender || 'SMS',
    };
  }

  // Step 2: Run local LLM fallback if regex fails
  if (result && result.needsLLMFallback) {
    try {
      const aiResult = await localLlmFallbackExtract(text);
      result = { ...result, ...aiResult };
    } catch (err) {
      console.warn('[SMS Ingest Bridge] Local LLM extraction fallback error:', err);
    }
  }

  // Step 3: Save to flat-JSON database if it's a valid spend/credit alert or needs review
  if (result && !result.notATransaction) {
    const savedRecord = await db.addTransaction({
      ...result,
      rawText: text,
      sender: sender || 'SMS',
      date: date || new Date().toISOString(),
    });

    // Notify UI components (Dashboard.js) to refresh
    DeviceEventEmitter.emit('TRANSACTION_ADDED', savedRecord);
    return savedRecord;
  }

  return null;
}

/**
 * Start listening for native SMS events
 */
export function initSmsListener(onTransactionAdded) {
  if (onTransactionAdded) {
    listenerSubscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', onTransactionAdded);
  }

  // Listen for native Android SMS broadcast events if bridge is present
  const smsNativeEmitter = NativeModules.SmsReceiver ? new NativeEventEmitter(NativeModules.SmsReceiver) : DeviceEventEmitter;
  smsNativeEmitter.addListener('onSmsReceived', (event) => {
    processIncomingSms({
      sender: event.originatingAddress || event.sender || 'SMS',
      text: event.body || event.message || event.text || '',
      date: event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    });
  });

  return () => {
    if (listenerSubscription) listenerSubscription.remove();
  };
}
