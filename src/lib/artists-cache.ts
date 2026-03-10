/**
 * Persistent cache for indie rock artist recommendations (Postgres).
 */

import { neon } from "@neondatabase/serverless";

const CACHE_KEY = "artists_default";

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export interface CachedArtistsPayload {
  artists: unknown[];
  cachedAt: number;
  version: number;
}

export async function initArtistsCacheTable(): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS artists_recommendations_cache (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/** Returns cached payload if present. By default, require it to be younger than TTL_HOURS. */
export async function getArtistsCache(options?: {
  allowStale?: boolean;
}): Promise<CachedArtistsPayload | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = options?.allowStale
      ? await sql`
          SELECT data, cached_at
          FROM artists_recommendations_cache
          WHERE key = ${CACHE_KEY}
          ORDER BY cached_at DESC
          LIMIT 1
        `
      : await sql`
          SELECT data, cached_at
          FROM artists_recommendations_cache
          WHERE key = ${CACHE_KEY}
            AND cached_at > NOW() - INTERVAL '24 hours'
          LIMIT 1
        `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !row.data) return null;
    const data = row.data as Record<string, unknown>;
    const cachedAt = row.cached_at instanceof Date ? row.cached_at.getTime() : Date.now();
    return {
      artists: (data.artists as unknown[]) ?? [],
      cachedAt,
      version: Number(data.version) ?? 0,
    };
  } catch {
    return null;
  }
}

/** Writes the payload to Postgres (upsert). */
export async function setArtistsCache(payload: CachedArtistsPayload): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  try {
    const dataStr = JSON.stringify(payload);
    await sql`
      INSERT INTO artists_recommendations_cache (key, data, cached_at)
      VALUES (${CACHE_KEY}, ${dataStr}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        cached_at = EXCLUDED.cached_at
    `;
  } catch (e) {
    console.error("[artists-cache] setArtistsCache error:", e);
  }
}
