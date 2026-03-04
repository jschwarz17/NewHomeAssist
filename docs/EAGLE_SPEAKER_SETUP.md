# Eagle Speaker Recognition (Android)

Ara uses **Picovoice Eagle** on Android to recognize who is speaking (Jesse or Vanessa) so responses can be personalized. This follows the [Eagle Android Quick Start](https://picovoice.ai/docs/quick-start/eagle-android/).

## Requirements

- **Android device** (Eagle runs in the native app, not in the browser).
- **Picovoice Access Key** – same key as for Porcupine (wake word). Get it from [Picovoice Console](https://console.picovoice.ai/).
- **RECORD_AUDIO** permission – the app requests this when you enroll or start recognition.

## How it works

1. **Enrollment** – Each speaker (Jesse, Vanessa) enrolls once by speaking for a few seconds in a quiet environment. The app records audio and builds a voice profile, stored on the device.
2. **Recognition** – When you tap **Start listening**, the app starts Eagle recognition. As you speak, Eagle matches the voice to the enrolled profiles and sets **speakerId** (jesse/vanessa). The assistant (Grok/Claude) uses this for personalization.

## Setup

### 1. Build and run the Android app

```bash
npm run build:cap
npx cap sync android
npx cap open android
```

Run the app on a device or emulator (microphone required).

### 2. Set your Picovoice key

Use the same key as for Porcupine:

- **Vercel / server:** `PICOVOICE_API_KEY`
- **Client (browser):** `NEXT_PUBLIC_PICOVOICE_API_KEY`

The Android app receives the key from the WebView when you start listening (passed from the voice UI).

### 3. Enroll each speaker (one-time)

Eagle needs a voice profile per user. **In the Android app:** open **Settings** and use the **Voice ID (Eagle)** section:

1. Tap **Enroll Jesse** — Jesse speaks for a few seconds in a quiet room until enrollment reaches 100%.
2. Tap **Enroll Vanessa** — Vanessa does the same.

Both must be enrolled before recognition works. The section shows “enrolled” next to each name when done.

**Alternative (console):** When running on Android, you can still enroll from the WebView console (e.g. via Chrome remote debugging) if needed:

```javascript
const { Capacitor } = await import('@capacitor/core');
await Capacitor.Plugins.Eagle.enrollSpeaker({ speakerId: 'jesse', accessKey: 'YOUR_PICOVOICE_ACCESS_KEY' });
// Speak for a few seconds, then repeat for vanessa.
```

### 4. Use voice as usual

After at least one enrollment (or both jesse and vanessa), tap **Start listening**. When Eagle recognizes the speaker, the UI shows the name and the assistant uses it for personalized replies.

## Technical details

- **Dependency:** `ai.picovoice:eagle-android:1.0.1` (see `android/app/build.gradle`).
- **Plugin:** `EaglePlugin.java` – enrollment (records and enrolls until 100%), recognition (runs in a background thread and emits `speaker` events), profile storage in `SharedPreferences`.
- **Web:** `src/lib/eagle.ts` – checks for Android, calls the plugin, and subscribes to speaker events. `VoiceProvider` starts/stops Eagle when you start/stop listening and updates `speakerId` from events.

## Troubleshooting

- **"Enroll both jesse and vanessa first"** – Run enrollment for each speaker at least once.
- **"RECORD_AUDIO permission required"** – Grant microphone permission when the app asks.
- **Speaker not updating** – Ensure a quiet environment and that the enrolled speaker is the one talking. Re-enroll if you changed microphone or environment.
