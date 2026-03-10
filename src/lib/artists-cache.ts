/**
 * Persistent cache for indie rock artist recommendations.
 * Prefers Postgres (Neon) when DATABASE_URL / POSTGRES_URL is set;
 * falls back to a local JSON file so local dev works without a database.
 */

import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const CACHE_KEY = "artists_default";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const LOCAL_CACHE_DIR = path.resolve(process.cwd(), ".cache");
const LOCAL_CACHE_FILE = path.join(LOCAL_CACHE_DIR, "artists.json");

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

// ── Local file cache helpers ────────────────────────────────────────────────

function readFileCache(): CachedArtistsPayload | null {
  try {
    if (!fs.existsSync(LOCAL_CACHE_FILE)) return null;
    const raw = fs.readFileSync(LOCAL_CACHE_FILE, "utf-8");
    const entry = JSON.parse(raw) as CachedArtistsPayload;
    if (Date.now() - entry.cachedAt < TTL_MS) return entry;
  } catch {
    // corrupt or unreadable — treat as cache miss
  }
  return null;
}

function writeFileCache(payload: CachedArtistsPayload): void {
  try {
    if (!fs.existsSync(LOCAL_CACHE_DIR)) {
      fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_CACHE_FILE, JSON.stringify(payload), "utf-8");
  } catch (e) {
    console.error("[artists-cache] writeFileCache error:", e);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

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

/** Returns cached payload if present and younger than 24 h; otherwise null. */
export async function getArtistsCache(): Promise<CachedArtistsPayload | null> {
  // Try Postgres first
  const sql = getSql();
  if (sql) {
    try {
      const rows = await sql`
        SELECT data, cached_at
        FROM artists_recommendations_cache
        WHERE key = ${CACHE_KEY}
          AND cached_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row?.data) {
        const data = row.data as Record<string, unknown>;
        const cachedAt = row.cached_at instanceof Date ? row.cached_at.getTime() : Date.now();
        return {
          artists: (data.artists as unknown[]) ?? [],
          cachedAt,
          version: Number(data.version) ?? 0,
        };
      }
    } catch {
      // fall through to file cache
    }
  }

  // Fall back to local file cache
  return readFileCache();
}

/** Writes the payload to Postgres (if available) and always to local file. */
export async function setArtistsCache(payload: CachedArtistsPayload): Promise<void> {
  // Always write to file so local dev has a cache
  writeFileCache(payload);

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
