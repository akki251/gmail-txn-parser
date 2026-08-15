package com.personal.gmailtxnparser

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val sender = messages[0].displayOriginatingAddress ?: "SMS"
            val fullBodyBuilder = StringBuilder()
            val timestamp = messages[0].timestampMillis

            for (sms in messages) {
                fullBodyBuilder.append(sms.displayMessageBody ?: "")
            }

            val body = fullBodyBuilder.toString()
            Log.d("SmsReceiver", "Incoming full SMS from $sender: $body")

            val prefs = context?.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
            val existingJson = prefs?.getString("pending_sms", "[]") ?: "[]"
            val smsArray = try { JSONArray(existingJson) } catch (e: Exception) { JSONArray() }

            val smsObj = JSONObject().apply {
                put("sender", sender)
                put("body", body)
                put("timestamp", timestamp)
            }
            smsArray.put(smsObj)
            prefs?.edit()?.putString("pending_sms", smsArray.toString())?.apply()

            // Also notify live JS bridge if running
            SmsModule.sendSmsEvent(sender, body, timestamp)
        }
    }
}
