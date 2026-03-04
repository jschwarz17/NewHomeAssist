# Deployment & Development Workflow

## Architecture

- **Frontend (tablet):** Next.js static export (`out/`) wrapped in Capacitor → runs on Android tablet.
- **Backend:** Next.js API routes deployed on **Vercel** (Grok chat, Grok Voice Agent token, personalization, Tasker command parsing).
- **Voice:** Picovoice (Porcupine wake phrase “Hi Ara”, Eagle speaker ID: Jesse / Vanessa) runs in the app; STT and assistant hit the Vercel API; Ara's voice via Grok Voice Agent (ephemeral token from `/api/realtime-token`).

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

### Env vars (two places — neither is in git)

**Environment variables are never pushed to git.** You configure them in two places:

1. **In this repo (`.env.local`)** — used when you run `npm run build:cap`. These values get baked into the Android app. **Use one variable per line** (no commas, no multiple vars on one line):
   - `NEXT_PUBLIC_PICOVOICE_API_KEY` – for wake word (Porcupine) + Eagle. Get from [Picovoice Console](https://console.picovoice.ai/).
   - `NEXT_PUBLIC_ASSISTANT_API_URL` – **required for the tablet.** Set to your Vercel URL (e.g. `https://your-app.vercel.app`). No trailing slash. Without this, the app has no server to call, so widgets show “set NEXT_PUBLIC_ASSISTANT_API_URL” and the assistant won’t work.

   Example `.env.local`:
   ```
   NEXT_PUBLIC_PICOVOICE_API_KEY=your-picovoice-key-here
   NEXT_PUBLIC_ASSISTANT_API_URL=https://your-app.vercel.app
   ```

2. **On Vercel (Dashboard → Project → Settings → Environment Variables)** — used when API routes run on Vercel:
   - `NEWS_API_KEY` – for fintech and indie rock news widgets. Get from [NewsAPI](https://newsapi.org/register).
   - `ALPHA_VANTAGE_KEY` – for stock prices widget. Get from [Alpha Vantage](https://www.alphavantage.co/support/#api-key).
   - `XAI_API_KEY`, `CLAUDE_API_KEY`, `PICOVOICE_API_KEY`, etc. as in `.env.example`.

If widgets say “Add NEWS_API_KEY” or “set NEXT_PUBLIC_ASSISTANT_API_URL”, the app either isn’t calling Vercel (missing `NEXT_PUBLIC_ASSISTANT_API_URL` in `.env.local` when you built) or the key isn’t set on Vercel. Fix both, then rebuild the app and redeploy.

**Wake word not working on the tablet:** (1) Add `NEXT_PUBLIC_PICOVOICE_API_KEY` to `.env.local`, run `npm run build:cap` and `npx cap sync android`, then reinstall the app — the key is baked in at build time and is not in git. (2) Grant the app microphone permission. (3) Without custom “Hey Ara” files, say **“Porcupine”** to test. See [docs/PICOVOICE_HI_ARA.md](PICOVOICE_HI_ARA.md).

## Production

### 1. Deploy backend (API) to Vercel

- Push the repo and connect it to Vercel.
- **Do not** set `BUILD_FOR_CAPACITOR` in Vercel — the default build must run without static export so `/api/assistant` and `/api/realtime-token` are deployed as serverless functions.
- Add env vars in Vercel: `XAI_API_KEY` (and optionally `GROK_MODEL`).
- Deploy. Note the URL (e.g. `https://jesse-home-assistant.vercel.app`).

**If you get 404 at your Vercel URL**, fix the project configuration:

1. Open the project on [Vercel Dashboard](https://vercel.com/dashboard) → **Settings** → **General**.
2. **Framework Preset:** set to **Next.js** (not "Other").
3. **Root Directory:** leave **empty** (repo root).
4. Go to **Build & Development Settings** (or **Settings** → same section).
5. **Output Directory:** leave **empty**. If it is set to `out`, clear it — that folder is only for the Capacitor static build; on Vercel the app is built as standard Next.js (no static export).
6. **Build Command:** `next build` or leave default.
7. **Redeploy:** Deployments → ⋯ on latest → **Redeploy** and enable **Clear build cache**.

### 2. Build frontend for tablet

- Set `NEXT_PUBLIC_ASSISTANT_API_URL` to your Vercel URL (e.g. `https://jesse-home-assistant.vercel.app`).
- Build the static export and sync to Android (use `build:cap` so only the static site is built; the tablet calls the Vercel API):

```bash
npm run build:cap
npx cap sync android
```

- Open the Android project in Android Studio and run on the tablet (or build an APK/AAB).

One-liner that builds and opens Android Studio:

```bash
npm run cap:android
```

### 3. Tasker (Android)

- The app sends intents with action `com.jesse.assistant.COMMAND` and extras `task`, `value`.
- A **Tasker plugin** is included: `android/.../TaskerPlugin.java` broadcasts this intent; `MainActivity` registers it. After you run the app from Android Studio (or build a new APK), the app will call Tasker via the plugin when the API returns a `taskerCommand`.
- On the tablet, in **Tasker**, create a profile: **Event** → **Intent Received** → Action `com.jesse.assistant.COMMAND`. Use `%task` and `%value` in your task. See **[docs/TASKER_SETUP.md](TASKER_SETUP.md)** for step-by-step and examples.

## Summary

| Environment      | Frontend source     | API / backend          |
|------------------|---------------------|-------------------------|
| Local dev (web)  | `next dev`          | Same host `/api`       |
| Dev on tablet    | Laptop IP:3000      | Laptop or Vercel       |
| Production tablet| Static `out/` in app| Vercel (NEXT_PUBLIC_ASSISTANT_API_URL) |
