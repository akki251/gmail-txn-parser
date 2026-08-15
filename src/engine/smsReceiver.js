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
import { isNonTransactional } from '../parsers/nonTransactional';

export async function processIncomingSms({ sender, text, date }) {
  if (!text) return null;

  await db.loadDb();
  console.log('[SMS Ingest Bridge] Processing incoming SMS:', { sender, text });

  // Pre-filter non-transactional alerts (pending payment requests, OTPs, due reminders)
  if (isNonTransactional(text)) {
    console.log('[SMS Ingest Bridge] Non-transactional alert ignored:', text);
    return { notATransaction: true };
  }

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
 * Drain background SMS items persisted while app was killed/closed
 */
export async function checkPendingBackgroundSms() {
  if (NativeModules.SmsReceiver && NativeModules.SmsReceiver.getPendingSms) {
    try {
      const pendingJson = await NativeModules.SmsReceiver.getPendingSms();
      const pendingList = JSON.parse(pendingJson || '[]');
      if (Array.isArray(pendingList) && pendingList.length > 0) {
        console.log(`[SMS Ingest Bridge] Draining ${pendingList.length} background SMS items...`);
        for (const item of pendingList) {
          await processIncomingSms({
            sender: item.sender || 'SMS',
            text: item.body || '',
            date: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
          });
        }
        await NativeModules.SmsReceiver.clearPendingSms();
      }
    } catch (err) {
      console.warn('[SMS Ingest Bridge] Pending background SMS drain error:', err);
    }
  }
}

/**
 * Sync system SMS inbox to catch messages delivered while device was powered off
 */
export async function syncInboxSms(daysAgo = 30) {
  if (NativeModules.SmsReceiver && NativeModules.SmsReceiver.readInboxSms) {
    try {
      const sinceTimestamp = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
      const inboxList = await NativeModules.SmsReceiver.readInboxSms(sinceTimestamp);
      if (Array.isArray(inboxList) && inboxList.length > 0) {
        console.log(`[SMS Ingest Bridge] Syncing ${inboxList.length} inbox SMS items...`);
        for (const item of inboxList) {
          await processIncomingSms({
            sender: item.sender || 'SMS',
            text: item.body || '',
            date: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn('[SMS Ingest Bridge] Inbox SMS sync error:', err);
    }
  }
}

/**
 * Start listening for native SMS events
 */
export function initSmsListener(onTransactionAdded) {
  if (onTransactionAdded) {
    listenerSubscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', onTransactionAdded);
  }

  // Drain background SMS queue + sync inbox for power-off recovery
  checkPendingBackgroundSms().then(() => syncInboxSms());

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
