import { NextResponse } from "next/server";
import { getShowsCache, setShowsCache } from "@/lib/shows-cache";
import { fetchRecommendationsFromGrok, type ShowItem } from "@/lib/shows-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Re-export for consumers that import from the route
export type { ShowItem } from "@/lib/shows-recommendations-grok";
export type { ShowMood } from "@/lib/shows-recommendations-grok";

export async function GET() {
  const apiKey = process.env.XAI_API_KEY;

  // 1. Prefer persistent cache (filled by 6am cron or a previous request)
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

  // 2. No cache or stale: call Grok (e.g. first request of the day before cron, or no Postgres)
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await fetchRecommendationsFromGrok(apiKey);
    await setShowsCache({
      shows: result.shows,
      movies: result.movies,
      cachedAt: result.cachedAt,
      version: result.version,
    });
    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[shows/recommendations] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recommendations", details: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
