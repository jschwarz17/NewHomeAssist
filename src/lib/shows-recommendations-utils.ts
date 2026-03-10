import type { RecommendationsResult, ShowItem } from "@/lib/shows-recommendations-grok";
interface RecommendationsLikePayload {
  shows?: unknown[];
  movies?: unknown[];
  cachedAt?: number;
  version?: number;
}


export const SHOWS_TARGET_COUNT = 10;
export const SHOWS_ROUTE_VERSION = 8;

export interface ReleaseWindow {
  currentYear: number;
  previousYear: number;
  allowedYears: Set<string>;
}

export function getReleaseWindow(now = new Date()): ReleaseWindow {
  const currentYear = now.getUTCFullYear();
  const previousYear = currentYear - 1;

  return {
    currentYear,
    previousYear,
    allowedYears: new Set([String(currentYear), String(previousYear)]),
  };
}

function normalizeYear(value: unknown): string {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePosterUrl(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.startsWith("http") ? normalized : null;
}

function normalizeMood(value: unknown): ShowItem["mood"] {
  const mood = normalizeText(value).toLowerCase();
  if (
    mood === "fun" ||
    mood === "gritty" ||
    mood === "quirky" ||
    mood === "funny" ||
    mood === "suspenseful"
  ) {
    return mood;
  }
  return "gritty";
}

function normalizeShowItem(candidate: unknown, type: ShowItem["type"], window: ReleaseWindow): ShowItem | null {
  if (!candidate || typeof candidate !== "object") return null;

  const item = candidate as Partial<ShowItem>;
  const title = normalizeText(item.title);
  const year = normalizeYear(item.year);
  const description = normalizeText(item.description);
  const streamingService = normalizeText(item.streamingService);

  if (!title || !year || !window.allowedYears.has(year) || !description || !streamingService) {
    return null;
  }

  return {
    title,
    year,
    type,
    description,
    genre: normalizeText(item.genre) || (type === "show" ? "Drama" : "Thriller"),
    country: normalizeText(item.country) || "USA",
    language: normalizeText(item.language) || "English",
    streamingService,
    tmdbSearchTitle: normalizeText(item.tmdbSearchTitle) || title,
    trailerSearchQuery:
      normalizeText(item.trailerSearchQuery) || `${title} ${year} official trailer`,
    trailerVideoId: normalizeText(item.trailerVideoId) || null,
    mood: normalizeMood(item.mood),
    posterUrl: normalizePosterUrl(item.posterUrl),
  };
}

export function sanitizeShowList(
  items: unknown[] | undefined,
  type: ShowItem["type"],
  window = getReleaseWindow()
): ShowItem[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const sanitized: ShowItem[] = [];

  for (const candidate of items) {
    const normalized = normalizeShowItem(candidate, type, window);
    if (!normalized) continue;

    const dedupeKey = `${normalized.type}:${normalized.title.toLowerCase()}:${normalized.year}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    sanitized.push(normalized);
  }

  return sanitized;
}

export function mergeShowLists(...lists: ShowItem[][]): ShowItem[] {
  const seen = new Set<string>();
  const merged: ShowItem[] = [];

  for (const list of lists) {
    for (const item of list) {
      const dedupeKey = `${item.type}:${item.title.toLowerCase()}:${item.year}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push(item);
    }
  }

  return merged;
}

export function buildRecommendationsResult(
  payload: RecommendationsLikePayload,
  window = getReleaseWindow()
): RecommendationsResult {
  return {
    shows: sanitizeShowList(payload.shows as unknown[] | undefined, "show", window).slice(
      0,
      SHOWS_TARGET_COUNT
    ),
    movies: sanitizeShowList(payload.movies as unknown[] | undefined, "movie", window).slice(
      0,
      SHOWS_TARGET_COUNT
    ),
    cachedAt:
      typeof payload.cachedAt === "number" && Number.isFinite(payload.cachedAt)
        ? payload.cachedAt
        : Date.now(),
    version:
      typeof payload.version === "number" && Number.isFinite(payload.version)
        ? payload.version
        : SHOWS_ROUTE_VERSION,
  };
}

export function mergeRecommendationSources(
  sources: Array<RecommendationsLikePayload | null | undefined>,
  window = getReleaseWindow()
): RecommendationsResult {
  const showLists = sources.map((source) =>
    sanitizeShowList(source?.shows as unknown[] | undefined, "show", window)
  );
  const movieLists = sources.map((source) =>
    sanitizeShowList(source?.movies as unknown[] | undefined, "movie", window)
  );

  return {
    shows: mergeShowLists(...showLists).slice(0, SHOWS_TARGET_COUNT),
    movies: mergeShowLists(...movieLists).slice(0, SHOWS_TARGET_COUNT),
    cachedAt: Date.now(),
    version: SHOWS_ROUTE_VERSION,
  };
}

export function hasCompleteShowCounts(result: RecommendationsResult): boolean {
  return (
    result.shows.length === SHOWS_TARGET_COUNT &&
    result.movies.length === SHOWS_TARGET_COUNT
  );
}
