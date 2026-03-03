# Jesse Home Assistant

Personalized AI home assistant: hybrid **Next.js + Capacitor** Android app for a dedicated tablet. Uses **Picovoice** (Porcupine wake word, Eagle speaker ID), a **Vercel-hosted** backend for Gemini and personal context, and **Android Intents** for Tasker integration.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Native:** Capacitor (Android tablet)
- **Voice:** Picovoice — Porcupine (wake word “Hey Assistant”), Eagle (Jesse / Vanessa)
- **Backend:** Next.js API routes on Vercel (Gemini, personalization)
- **Automation:** Android Intents → Tasker (`com.jesse.assistant.COMMAND`)

## Setup

1. Clone and install: `npm install`
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` — [Picovoice Console](https://console.picovoice.ai/)
   - `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey)
   - `NEXT_PUBLIC_ASSISTANT_API_URL` — Vercel API URL (for tablet build)
3. **Development:** `npm run dev` → http://localhost:3000
4. **Tablet build:** `npm run cap:android` (builds, syncs to Android, opens Android Studio)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for live reload on tablet, Vercel deploy, and Tasker intent setup.

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Static export → `out/` (for Capacitor) |
| `npm run cap:sync` | Sync `out/` to Android project |
| `npm run cap:android` | Build + sync + open Android Studio |

## Project layout

| Path | Purpose |
|------|--------|
| `src/context/VoiceProvider.tsx` | Porcupine (wake word) + Eagle (speaker ID) + STT flow |
| `src/app/api/assistant/route.ts` | Gemini + Jesse/Vanessa context + Tasker command parsing |
| `src/lib/tasker.ts` | Send Intent `com.jesse.assistant.COMMAND` with `task`, `value` |
| `capacitor.config.ts` | App ID `com.jesse.assistant`, webDir `out`, Android scheme + cleartext |
| `next.config.ts` | `output: 'export'`, `images.unoptimized`, `trailingSlash` |

## Personalization (API)

- **Jesse:** fintech metrics, GitHub updates, no cheese / no dairy.
- **Vanessa:** calendar and music preferences (e.g. Sonos).

Speaker ID from Eagle is sent to the API so Gemini responses are personalized. Home control commands (e.g. “Dim the lights”, “Play Sonos”) are parsed and returned as `taskerCommand`; the app sends them via the Tasker intent.
