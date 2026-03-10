import { NextResponse } from "next/server";
import { getShowsCache, setShowsCache } from "@/lib/shows-cache";
import { fetchRecommendationsFromGrok } from "@/lib/shows-recommendations-grok";
import type { ShowItem } from "@/lib/shows-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Re-export for consumers that import from the route
export type { ShowItem } from "@/lib/shows-recommendations-grok";
export type { ShowMood } from "@/lib/shows-recommendations-grok";

export async function GET() {
  // 1. Prefer persistent cache (filled by cron, Postgres, or local file)
  const cached = await getShowsCache();
  if (cached && cached.shows.length > 0) {
    return NextResponse.json(
      {
        shows: cached.shows as ShowItem[],
        movies: cached.movies as ShowItem[],
        cachedAt: cached.cachedAt,
        version: cached.version,
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. No cache — try fetching on-demand from Grok if API key is available
  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const result = await fetchRecommendationsFromGrok(apiKey);
      await setShowsCache({
        shows: result.shows,
        movies: result.movies,
        cachedAt: result.cachedAt,
        version: result.version,
      });
      return NextResponse.json(
        {
          shows: result.shows,
          movies: result.movies,
          cachedAt: result.cachedAt,
          version: result.version,
        },
        { headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error("[shows/recommendations] on-demand Grok error:", err);
      return NextResponse.json(
        {
          error: "Failed to fetch recommendations. Please try again.",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // 3. No cache and no API key
  return NextResponse.json(
    {
      error:
        "XAI_API_KEY is not configured. Set it in .env.local to enable recommendations.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
