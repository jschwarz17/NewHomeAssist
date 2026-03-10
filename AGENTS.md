# AGENTS.md

## Cursor Cloud specific instructions

**Product**: Jesse Home Assistant ("Ara") — a Next.js 16 + Capacitor hybrid AI home assistant for a dedicated Android tablet.

**Single service**: Next.js dev server (`npm run dev` on port 3000) serves both the frontend and all API routes. No Docker, no database containers, no separate backend process needed.

### Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Build (Vercel) | `npm run build` |
| Build (Capacitor) | `npm run build:cap` |

See `README.md` **Commands** table for the full list including Capacitor sync/open.

### Non-obvious notes

- **No test suite**: The project has no automated test framework or test files. Validation is done via lint (`npm run lint`) and build (`npm run build`).
- **Pre-existing lint errors**: ESLint reports ~11 errors and ~18 warnings in the existing codebase (React hooks set-state-in-effect, no-require-imports in the Capacitor build script, etc.). These are not regressions.
- **Trailing slash routing**: `next.config.ts` has `trailingSlash: true`. API routes require a trailing slash when called with `curl` (e.g. `curl http://localhost:3000/api/user-context/`). The dev server auto-redirects in the browser but not always with `curl`.
- **External API keys are optional**: All external services (xAI Grok, Picovoice, Claude, Spotify, NewsAPI, etc.) degrade gracefully when keys are absent. The app loads and navigates fully without any keys set. Widgets show placeholder text like "set NEWS_API_KEY".
- **`.env.local`**: Copy `.env.example` to `.env.local` for local development. The dev server reads from `.env.local` automatically.
- **SQLite**: The learning engine uses `better-sqlite3` with a local `ara.db` file auto-created on first use. No separate database setup required.
- **Capacitor / Android**: Only relevant for tablet builds. Web development works entirely without Android SDK or Capacitor.
- **Shows & Artists cache**: Both modules use a two-tier cache: Postgres (Neon) when `DATABASE_URL`/`POSTGRES_URL` is set, otherwise local JSON files in `.cache/`. When cache is empty and `XAI_API_KEY` is configured, the recommendation routes call Grok on-demand (takes ~30-90s on first load, then cached for 24h). The `.cache/` directory is git-ignored.
- **Client-side timeout**: The Shows and Artists contexts use a 120s fetch timeout to accommodate on-demand Grok API calls on first load without cache.
