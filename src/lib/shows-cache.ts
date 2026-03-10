/**
 * Persistent cache for Ara recommendations (Postgres).
 * Used so one daily Grok run at 6am can pre-fill the cache and the app always reads instantly.
 */

import { neon } from "@neondatabase/serverless";

const CACHE_KEY = "default";

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export interface CachedShowsPayload {
  shows: unknown[];
  movies: unknown[];
  cachedAt: number;
  version: number;
}

export async function initShowsCacheTable(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS shows_recommendations_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** Returns cached payload if present. By default, require it to be younger than TTL_HOURS. */
export async function getShowsCache(options?: {
  allowStale?: boolean;
}): Promise<CachedShowsPayload | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = options?.allowStale
      ? await sql`
          SELECT data, cached_at
          FROM shows_recommendations_cache
          WHERE key = ${CACHE_KEY}
          ORDER BY cached_at DESC
          LIMIT 1
        `
      : await sql`
          SELECT data, cached_at
          FROM shows_recommendations_cache
          WHERE key = ${CACHE_KEY}
            AND cached_at > NOW() - INTERVAL '24 hours'
          LIMIT 1
        `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.data) return null;
    const data = row.data as Record<string, unknown>;
    const cachedAt = row.cached_at instanceof Date ? row.cached_at.getTime() : Date.now();
    return {
      shows: (data.shows as unknown[]) ?? [],
      movies: (data.movies as unknown[]) ?? [],
      cachedAt,
      version: Number(data.version) ?? 0,
    };
  } catch {
    return null;
  }
}

/** Writes the payload to Postgres (upsert). */
export async function setShowsCache(payload: CachedShowsPayload): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    const dataStr = JSON.stringify(payload);
    await sql`
      INSERT INTO shows_recommendations_cache (key, data, cached_at)
      VALUES (${CACHE_KEY}, ${dataStr}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        cached_at = EXCLUDED.cached_at
    `;
  } catch (e) {
    console.error("[shows-cache] setShowsCache error:", e);
  }
}
