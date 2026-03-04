# Wake word "Hey Ara" with Picovoice

The app uses **Porcupine** (Picovoice) for wake word detection. By default it falls back to the built-in word **"Porcupine"** so you can test without extra setup. To use **"Hey Ara"** (or "Hi Ara"):

## 1. Create the custom wake word

1. Sign in at [Picovoice Console](https://console.picovoice.ai/).
2. Open **Porcupine** → create a **custom keyword**.
3. Enter the phrase **"Hey Ara"** (or "Hi Ara" if you prefer).
4. Choose platform **Web (WASM)** and download the `.ppn` file.

## 2. Add it to the project

1. For **"Hey Ara"**: rename the file to **`hey_ara.ppn`** and put it in **`public/hey_ara.ppn`**.
2. For **"Hi Ara"**: rename to **`hi_ara.ppn`** and put it in **`public/hi_ara.ppn`**.
3. The app tries **hey_ara.ppn** first, then **hi_ara.ppn**, then falls back to the built-in "Porcupine" wake word.
4. Rebuild and sync:
   - `npm run build:cap`
   - `npx cap sync android`

## Flow

1. User taps **Start listening** (e.g. on the Dashboard Voice panel).
2. Porcupine listens for the wake word ("Hey Ara", "Hi Ara", or "Porcupine").
3. When the wake word is detected, the app shows "Wake word detected" and starts **browser Speech Recognition** to capture the next thing you say.
4. The transcript appears; user can tap **Send to assistant** to send it to Grok, or you can extend the UI to send automatically.

## Eagle speaker recognition (Android)

On Android, the app can identify who is speaking (Jesse or Vanessa) using **Picovoice Eagle**. See [Eagle Speaker Setup](EAGLE_SPEAKER_SETUP.md) for enrollment and usage.
