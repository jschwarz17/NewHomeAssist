# Wake word "Hi Ara" with Picovoice

The app uses **Porcupine** (Picovoice) for wake word detection. By default it falls back to the built-in word **"Porcupine"** so you can test without extra setup. To use **"Hi Ara"** instead:

## 1. Create the custom wake word

1. Sign in at [Picovoice Console](https://console.picovoice.ai/).
2. Open **Porcupine** → create a **custom keyword**.
3. Enter the phrase **"Hi Ara"** (or "Hey Ara" if you prefer).
4. Choose platform **Web (WASM)** and download the `.ppn` file.

## 2. Add it to the project

1. Rename the downloaded file to **`hi_ara.ppn`**.
2. Put it in the **`public`** folder of this project:
   - `public/hi_ara.ppn`
3. Rebuild and sync:
   - `npm run build:cap`
   - `npx cap sync android`

After that, the app will use "Hi Ara" (or "Hey Ara", depending on what you trained) as the wake word instead of "Porcupine". If `hi_ara.ppn` is missing, the app keeps using the built-in "Porcupine" wake word.

## Flow

1. User taps **Start listening** (e.g. on the Dashboard Voice panel).
2. Porcupine listens for the wake word ("Hi Ara" or "Porcupine").
3. When the wake word is detected, the app shows "Wake word detected" and starts **browser Speech Recognition** to capture the next thing you say.
4. The transcript appears; user can tap **Send to assistant** to send it to Grok, or you can extend the UI to send automatically.
