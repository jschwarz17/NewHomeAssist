import { NextRequest, NextResponse } from "next/server";
import {
  CURATED_MOVIES,
  CURATED_SHOWS,
} from "@/lib/curated-shows";
import type { ShowItem } from "@/lib/shows-recommendations-grok";
import { fetchRecommendationsFromGrok } from "@/lib/shows-recommendations-grok";
import { getShowsCache, initShowsCacheTable, setShowsCache } from "@/lib/shows-cache";
import {
  buildRecommendationsResult,
  getReleaseWindow,
  hasCompleteShowCounts,
  mergeRecommendationSources,
  SHOWS_ROUTE_VERSION,
} from "@/lib/shows-recommendations-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function buildNotice(liveError: string | null): string | undefined {
  if (!liveError) return undefined;
  const normalized = liveError.toLowerCase();

  if (normalized.includes("used all available credits") || normalized.includes("monthly spending limit")) {
    return "Live Ara recommendations are temporarily unavailable because the xAI account has exhausted its credits or spending limit, so this page is showing the recent fallback picks instead.";
  }

  if (normalized.includes("timeout")) {
    return "Live Ara recommendations timed out, so this page is showing the recent fallback picks instead.";
  }

  return "Live Ara recommendations are temporarily unavailable, so this page is showing the recent fallback picks instead.";
}

// Re-export for consumers that import from the route
export type { ShowItem } from "@/lib/shows-recommendations-grok";
export type { ShowMood } from "@/lib/shows-recommendations-grok";

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const fallback = buildRecommendationsResult(
    {
      shows: CURATED_SHOWS as ShowItem[],
      movies: CURATED_MOVIES as ShowItem[],
      cachedAt: Date.now(),
      version: SHOWS_ROUTE_VERSION,
    },
    getReleaseWindow()
  );

  let liveError: string | null = null;

  try {
    await initShowsCacheTable();
  } catch {
    // Cache table creation is best-effort.
  }

  const freshCache = buildRecommendationsResult((await getShowsCache()) ?? {});
  if (hasCompleteShowCounts(freshCache)) {
    return NextResponse.json(
      {
        ...freshCache,
        source: "cache",
        debug: debug ? null : undefined,
      },
      { headers: CORS_HEADERS }
    );
  }

  const staleCache = buildRecommendationsResult(
    (await getShowsCache({ allowStale: true })) ?? {}
  );

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const live = buildRecommendationsResult(
        await fetchRecommendationsFromGrok(apiKey)
      );
      const merged = mergeRecommendationSources([live, freshCache, staleCache, fallback]);

      if (merged.shows.length > 0 || merged.movies.length > 0) {
        try {
          await setShowsCache({
            shows: merged.shows,
            movies: merged.movies,
            cachedAt: merged.cachedAt,
            version: merged.version,
          });
        } catch {
          // Cache writes are best-effort.
        }

        return NextResponse.json(
          {
            ...merged,
            source: "live",
            debug: debug ? null : undefined,
          },
          { headers: CORS_HEADERS }
        );
      }
    } catch (error) {
      liveError = error instanceof Error ? error.message : String(error);
    }
  }

  const mergedFallback = mergeRecommendationSources([freshCache, staleCache, fallback]);

  return NextResponse.json(
    {
      ...mergedFallback,
      source: staleCache.shows.length || staleCache.movies.length ? "stale-cache" : "fallback",
      notice: buildNotice(liveError),
      debug: debug ? liveError : undefined,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
