# Jesse Home Assistant

Personalized AI home assistant: hybrid **Next.js + Capacitor** Android app for a dedicated tablet. Uses **Picovoice** (wake phrase “Hi Ara”, Eagle speaker ID), **Grok** (xAI) for Ara’s brain and **Grok Voice Agent** for Ara’s voice, a **Vercel-hosted** backend, and **Android Intents** for Tasker integration.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Native:** Capacitor (Android tablet)
- **Voice:** Picovoice — Porcupine (wake phrase “Hi Ara”), Eagle (Jesse / Vanessa)
- **LLM & voice:** xAI Grok (chat for responses, Voice Agent for Ara’s voice)
- **Backend:** Next.js API routes on Vercel (Grok, personalization, realtime token)
- **Automation:** Android Intents → Tasker (`com.jesse.assistant.COMMAND`)

## Setup

1. Clone and install: `npm install`
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY` — [Picovoice Console](https://console.picovoice.ai/)
   - `XAI_API_KEY` — [xAI Console](https://console.x.ai/team/default/api-keys)
   - `NEXT_PUBLIC_ASSISTANT_API_URL` — Vercel API URL (for tablet build)
3. **Development:** `npm run dev` → http://localhost:3000
4. **Tablet build:** `npm run cap:android` (builds, syncs to Android, opens Android Studio)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for live reload on tablet, Vercel deploy, and Tasker intent setup.

## Ara’s voice (Grok Voice Agent)

For full “Ara speaks” experience, use the **Grok Voice Agent API** (real-time, voice “Ara”):

1. **Token:** `POST /api/realtime-token` returns an ephemeral token (server uses `XAI_API_KEY`).
2. **Connect:** Open `wss://api.x.ai/v1/realtime` with `Authorization: Bearer <token>`.
3. **Session:** Send `session.update` with `session.voice = "Ara"` and your `instructions` (e.g. “You are Ara, a warm and friendly home assistant…”).
4. Stream audio in/out per [xAI Voice Agent API](https://docs.x.ai/developers/model-capabilities/audio/voice-agent).

The app’s `useVoice().getRealtimeToken()` fetches the token; you can then connect from the client to the Voice Agent with voice **Ara**.

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Full build (for Vercel; includes API routes) |
| `npm run build:cap` | Static export → `out/` (for Capacitor only) |
| `npm run cap:sync` | Sync `out/` to Android project |
| `npm run cap:android` | Static build + sync + open Android Studio |

## Project layout

| Path | Purpose |
|------|--------|
| `src/context/VoiceProvider.tsx` | Porcupine (“Hi Ara”) + Eagle (speaker ID) + STT flow; `getRealtimeToken()` for Voice Agent |
| `src/app/api/assistant/route.ts` | Grok chat + Jesse/Vanessa context + Tasker command parsing |
| `src/app/api/realtime-token/route.ts` | Ephemeral token for Grok Voice Agent (Ara’s voice) |
| `src/lib/tasker.ts` | Send Intent `com.jesse.assistant.COMMAND` with `task`, `value` |
| `capacitor.config.ts` | App ID `com.jesse.assistant`, webDir `out`, Android scheme + cleartext |
| `next.config.ts` | `output: 'export'`, `images.unoptimized`, `trailingSlash` |

## Personalization (API)

- **Jesse:** fintech metrics, GitHub updates, no cheese / no dairy.
- **Vanessa:** calendar and music preferences (e.g. Sonos).

Speaker ID from Eagle is sent to the API so Grok (Ara) responses are personalized. Home control commands (e.g. “Dim the lights”, “Play Sonos”) are parsed and returned as `taskerCommand`; the app sends them via the Tasker intent.
