# Wake word "Hey Ara" with Picovoice

The app uses **Porcupine** (Picovoice) for wake word detection. It tries **Hey Ara** / **Hi Ara** first; if those files are missing or are the wrong platform (e.g. Android .ppn in the browser), it falls back to the built-in word **"Porcupine"** so you can still start a voice conversation. For **"Hey Ara"** in the browser, you must use the **Web (WASM)** .ppn from Picovoice.

## 1. Create the custom wake word

1. Sign in at [Picovoice Console](https://console.picovoice.ai/).
2. Open **Porcupine** → create a **custom keyword**.
3. Enter the phrase **"Hey Ara"** (or **"Hi Ara"** if you prefer).
4. Choose platform **Web (WASM)** and download the `.ppn` file.

## 2. Add it to the project

1. For **"Hey Ara"**: rename the downloaded file to **`hey_ara.ppn`** and put it in **`public/hey_ara.ppn`**.
2. For **"Hi Ara"** only: rename to **`hi_ara.ppn`** and put it in **`public/hi_ara.ppn`**.
3. The app tries **hey_ara.ppn** first, then **hi_ara.ppn**. If neither exists, the Voice panel will show an error asking you to add the file.
4. Rebuild and sync:
   - `npm run build:cap`
   - `npx cap sync android`

## Flow

1. User taps **Start listening** (e.g. on the Dashboard Voice panel).
2. Porcupine listens for the wake word ("Hey Ara", "Hi Ara", or "Porcupine").
3. When the wake word is detected, the app shows "Wake word detected" and starts **browser Speech Recognition** to capture the next thing you say.
4. The transcript appears; user can tap **Send to assistant** to send it to Grok, or you can extend the UI to send automatically.

## Why the wake word might not work (Android)

1. **Missing Picovoice key in build** – The app needs `NEXT_PUBLIC_PICOVOICE_API_KEY` in `.env` when you run `npm run build:cap`. If it’s only set on Vercel, the Android build won’t have it. Rebuild with the key in the project’s `.env`.
2. **Microphone permission** – Grant the app microphone permission when prompted (required for wake word and Eagle).
3. **No custom keyword** – Without `hey_ara.ppn` or `hi_ara.ppn` in `public/`, the app uses the built-in word **"Porcupine"**. Say **"Porcupine"** to test. For **"Hey Ara"**, add the custom keyword file (steps above).
4. **Model file** – `public/porcupine_params.pv` is included so the engine can load. If you removed it, restore it from [Picovoice’s repo](https://github.com/Picovoice/porcupine/blob/master/lib/common/porcupine_params.pv).

## Eagle speaker recognition (Android)

On Android, the app can identify who is speaking (Jesse or Vanessa) using **Picovoice Eagle**. See [Eagle Speaker Setup](EAGLE_SPEAKER_SETUP.md) for enrollment and usage.
