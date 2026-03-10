import type { ArtistItem, ArtistsResult } from "@/lib/artists-recommendations-grok";

export const ARTISTS_TARGET_COUNT = 10;
export const ARTISTS_ROUTE_VERSION = 3;

interface ArtistsLikePayload {
  artists?: unknown[];
  cachedAt?: number;
  version?: number;
}

const LEGACY_ARTIST_BLOCKLIST = new Set([
  "radiohead",
  "foals",
  "queens of the stone age",
  "qotsa",
  "slowdive",
  "idles",
  "fontaines d.c.",
  "fontaines dc",
  "black country, new road",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeYear(value: unknown): string | null {
  const match = String(value ?? "").match(/\b(20\d{2})\b/);
  return match?.[1] ?? null;
}

function getAllowedBreakoutYears(now = new Date()): Set<string> {
  const currentYear = now.getUTCFullYear();
  return new Set([String(currentYear), String(currentYear - 1)]);
}

function normalizeArtistItem(candidate: unknown, allowedYears: Set<string>): ArtistItem | null {
  if (!candidate || typeof candidate !== "object") return null;

  const item = candidate as Partial<ArtistItem>;
  const name = normalizeText(item.name);
  const description = normalizeText(item.description);
  const genre = normalizeText(item.genre) || "indie rock";
  const breakoutYear = normalizeYear(item.breakoutYear);

  if (!name || !description || !breakoutYear || !allowedYears.has(breakoutYear)) {
    return null;
  }

  if (LEGACY_ARTIST_BLOCKLIST.has(name.toLowerCase())) {
    return null;
  }

  const spotifyId = normalizeText(item.spotifyId);
  const spotifyTrackUri = normalizeText(item.spotifyTrackUri);
  const imageUrl = normalizeText(item.imageUrl);

  return {
    name,
    description,
    genre,
    spotifyId: spotifyId.startsWith("spotify:artist:") ? spotifyId : null,
    spotifyTrackUri: spotifyTrackUri.startsWith("spotify:track:") ? spotifyTrackUri : null,
    imageUrl: imageUrl.startsWith("http") ? imageUrl : null,
    breakoutYear,
    tractionSummary: normalizeText(item.tractionSummary) || null,
  };
}

export function sanitizeArtistList(items: unknown[] | undefined, now = new Date()): ArtistItem[] {
  if (!Array.isArray(items)) return [];

  const allowedYears = getAllowedBreakoutYears(now);
  const seen = new Set<string>();
  const sanitized: ArtistItem[] = [];

  for (const candidate of items) {
    const normalized = normalizeArtistItem(candidate, allowedYears);
    if (!normalized) continue;

    const dedupeKey = normalized.name.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    sanitized.push(normalized);
  }

  return sanitized;
}

export function mergeArtistLists(...lists: ArtistItem[][]): ArtistItem[] {
  const seen = new Set<string>();
  const merged: ArtistItem[] = [];

  for (const list of lists) {
    for (const item of list) {
      const dedupeKey = item.name.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push(item);
    }
  }

  return merged;
}

export function buildArtistsResult(payload: ArtistsLikePayload, now = new Date()): ArtistsResult {
  return {
    artists: sanitizeArtistList(payload.artists as unknown[] | undefined, now).slice(
      0,
      ARTISTS_TARGET_COUNT
    ),
    cachedAt:
      typeof payload.cachedAt === "number" && Number.isFinite(payload.cachedAt)
        ? payload.cachedAt
        : Date.now(),
    version:
      typeof payload.version === "number" && Number.isFinite(payload.version)
        ? payload.version
        : ARTISTS_ROUTE_VERSION,
  };
}

export function mergeArtistSources(
  sources: Array<ArtistsLikePayload | null | undefined>,
  now = new Date()
): ArtistsResult {
  const lists = sources.map((source) =>
    sanitizeArtistList(source?.artists as unknown[] | undefined, now)
  );

  return {
    artists: mergeArtistLists(...lists).slice(0, ARTISTS_TARGET_COUNT),
    cachedAt: Date.now(),
    version: ARTISTS_ROUTE_VERSION,
  };
}

export function hasCompleteArtistCount(result: ArtistsResult): boolean {
  return result.artists.length === ARTISTS_TARGET_COUNT;
}
