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
            val prefs = context?.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
            val existingJson = prefs?.getString("pending_sms", "[]") ?: "[]"
            val smsArray = try { JSONArray(existingJson) } catch (e: Exception) { JSONArray() }

            for (sms in messages) {
                val sender = sms.displayOriginatingAddress ?: "SMS"
                val body = sms.displayMessageBody ?: ""
                val timestamp = sms.timestampMillis
                Log.d("SmsReceiver", "Incoming SMS from $sender: $body")

                val smsObj = JSONObject().apply {
                    put("sender", sender)
                    put("body", body)
                    put("timestamp", timestamp)
                }
                smsArray.put(smsObj)

                // Also notify live JS bridge if running
                SmsModule.sendSmsEvent(sender, body, timestamp)
            }

            prefs?.edit()?.putString("pending_sms", smsArray.toString())?.apply()
        }
    }
}
