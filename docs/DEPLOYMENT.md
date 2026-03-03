# Deployment & Development Workflow

## Architecture

- **Frontend (tablet):** Next.js static export (`out/`) wrapped in Capacitor → runs on Android tablet.
- **Backend:** Next.js API routes deployed on **Vercel** (Gemini, personalization, Tasker command parsing).
- **Voice:** Picovoice (Porcupine wake word “Hey Assistant”, Eagle speaker ID: Jesse / Vanessa) runs in the app; STT and assistant logic hit the Vercel API.

## Development

### Local web

```bash
npm run dev
```

Open http://localhost:3000. Set `NEXT_PUBLIC_ASSISTANT_API_URL=http://localhost:3000` so the assistant calls your local API (or leave unset to use `/api` on same host).

### Live reload on tablet

1. Run `npm run dev` on your laptop and note your laptop’s local IP (e.g. `192.168.1.10`).
2. In `capacitor.config.ts`, `server.cleartext: true` is already set so the WebView can load HTTP.
3. On the tablet, open the Capacitor app and point the app’s “dev server URL” to `http://<laptop-IP>:3000` (or configure this in the native project / Capacitor config if you use a custom dev URL).
4. The tablet will load the Next.js app from your laptop and you get live reload.

### Env vars

Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` – for Porcupine + Eagle.
- `GEMINI_API_KEY` – for the assistant API (used only on Vercel or when running `next dev` with API).
- `NEXT_PUBLIC_ASSISTANT_API_URL` – **on the tablet build**, set this to your Vercel URL (e.g. `https://jesse-home-assistant.vercel.app`) so the app calls the deployed API.

## Production

### 1. Deploy backend (API) to Vercel

- Push the repo and connect it to Vercel.
- Add env vars in Vercel: `GEMINI_API_KEY` (and any others the API needs).
- Deploy. Note the URL (e.g. `https://jesse-home-assistant.vercel.app`).

### 2. Build frontend for tablet

- Set `NEXT_PUBLIC_ASSISTANT_API_URL` to your Vercel URL (e.g. `https://jesse-home-assistant.vercel.app`).
- Build and sync to Android:

```bash
npm run build
npx cap sync android
```

- Open the Android project in Android Studio and run on the tablet (or build an APK/AAB).

One-liner that builds and opens Android Studio:

```bash
npm run cap:android
```

### 3. Tasker (Android)

- The app sends intents with action `com.jesse.assistant.COMMAND` and extras `task`, `value`.
- In Tasker, create a profile that reacts to this intent and runs the desired tasks (e.g. dim lights, Sonos).
- The native Android project must implement a Capacitor plugin that broadcasts this intent (see `src/lib/tasker.ts` and the fallback warning there). Implement the plugin in `android/` and register it so `Tasker.sendCommand({ task, value })` performs the broadcast.

## Summary

| Environment      | Frontend source     | API / backend          |
|------------------|---------------------|-------------------------|
| Local dev (web)  | `next dev`          | Same host `/api`       |
| Dev on tablet    | Laptop IP:3000      | Laptop or Vercel       |
| Production tablet| Static `out/` in app| Vercel (NEXT_PUBLIC_ASSISTANT_API_URL) |
