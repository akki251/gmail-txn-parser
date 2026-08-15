package com.personal.gmailtxnparser

import android.content.Context
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    init {
        Companion.reactContext = reactContext
    }

    override fun getName(): String {
        return "SmsReceiver"
    }

    @ReactMethod
    fun getPendingSms(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
            val pendingJson = prefs.getString("pending_sms", "[]") ?: "[]"
            promise.resolve(pendingJson)
        } catch (e: Exception) {
            promise.reject("SMS_FETCH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearPendingSms(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("pending_sms", "[]").apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SMS_CLEAR_ERROR", e.message)
        }
    }

    @ReactMethod
    fun readInboxSms(sinceTimestamp: Double, promise: Promise) {
        try {
            val uri = Uri.parse("content://sms/inbox")
            val selection = "date > ?"
            val selectionArgs = arrayOf(sinceTimestamp.toLong().toString())
            val cursor = reactApplicationContext.contentResolver.query(
                uri,
                arrayOf("address", "body", "date"),
                selection,
                selectionArgs,
                "date DESC"
            )

            val array = Arguments.createArray()
            cursor?.use { c ->
                val addressIdx = c.getColumnIndex("address")
                val bodyIdx = c.getColumnIndex("body")
                val dateIdx = c.getColumnIndex("date")

                while (c.moveToNext()) {
                    val map = Arguments.createMap()
                    map.putString("sender", if (addressIdx != -1) c.getString(addressIdx) else "SMS")
                    map.putString("body", if (bodyIdx != -1) c.getString(bodyIdx) else "")
                    map.putDouble("timestamp", if (dateIdx != -1) c.getLong(dateIdx).toDouble() else 0.0)
                    array.pushMap(map)
                }
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("INBOX_READ_ERROR", e.message)
        }
    }

    companion object {
        private var reactContext: ReactApplicationContext? = null

        fun sendSmsEvent(sender: String, body: String, timestamp: Long) {
            val params = Arguments.createMap().apply {
                putString("sender", sender)
                putString("body", body)
                putDouble("timestamp", timestamp.toDouble())
            }
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onSmsReceived", params)
        }
    }
}
