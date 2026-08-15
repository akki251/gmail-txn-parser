package com.personal.gmailtxnparser

import android.content.Context
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
