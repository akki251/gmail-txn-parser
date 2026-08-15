# INSTRUCTIONS.md

## Project: `gmail-txn-parser-android`

**Target Architecture:** Fully local, offline-first, private Android application built with **Expo (Development Build workflow)**, leveraging on-device deterministic regex parsers and an ultra-lightweight local LLM fallback (**SmolLM2-360M** or **Qwen2.5-0.5B** via `llama.rn`) to parse bank SMS alerts into a local flat-JSON store with a built-in mini-Splitwise PWA interface. **Zero data leaves the device.**

---

## 1. Technical Stack & Core Modules

* **Framework:** React Native via **Expo SDK** (Managed workflow with Continuous Native Generation / `npx expo prebuild`).
* **Local Inference Engine:** `llama.rn` (native C++ bindings wrapping `llama.cpp` for Android CPU/OpenCL GPU acceleration).
* **Model Weight:** Quantized `.gguf` file (**SmolLM2-360M-Instruct-Q4_K_M** or **Qwen2.5-0.5B-Instruct-Q4_K_M**), stored locally in app sandbox storage.
* **Storage:** Local JSON file storage (`expo-file-system` + local state) mimicking the proven flat-JSON schema (`db.json`) for transactions, source messages, and expense splits.
* **SMS Ingestion:** Background or foreground automation bridge (via native SMS listener or local receiver loop) feeding incoming SMS strings directly into the on-device parsing pipeline.

---

## 2. Architecture & Pipeline Rules

1. **Deterministic First:** Incoming bank SMS texts are passed through `smsParsers.js` (pure regex filters). If a sender matches and the regex succeeds, transaction data is structured instantly with zero latency.
2. **Local AI Fallback:** If regex extraction fails, the raw SMS text is routed locally to the embedded `llama.rn` inference engine running the sub-1B GGUF model. It prompts strictly for JSON extraction (`amount`, `merchant`, `type`, `date`).
3. **Zero Silent Drops:** If both regex and local LLM extraction fail, the payload is captured and stored with `needsReview: true` and the raw text intact. It is never discarded.
4. **Air-Gapped Privacy:** No network calls are made for processing, categorization, or LLM inference. Everything stays local on the device.

---

## 3. Project Directory Structure

```
/
├── app.json                  # Expo config including llama.rn plugin settings
├── package.json              # Project dependencies & trustedDependencies configuration
├── src/
│   ├── parsers/
│   │   ├── smsParsers.js     # Pure regex templates per bank sender ID
│   │   └── nonTransactional.js# Pre-filters OTPs and non-spend alerts
│   ├── engine/
│   │   ├── matchingEngine.js # Multi-source reconciliation logic
│   │   └── localLLM.js       # llama.rn wrapper for local GGUF execution
│   ├── store/
│   │   └── db.js             # Flat-JSON persistence layer locally on device
│   └── screens/
│       ├── Dashboard.js      # Day-wise transaction list & trends
│       ├── Splitter.js       # Mini-Splitwise friend management & split loop
│       └── ReviewQueue.js    # Manual handling for needsReview items
└── assets/
    └── models/
        └── smollm2-360m-instruct-q4_k_m.gguf # Bundled or first-launch downloaded model weight
```
