import { NextResponse } from "next/server";
import { getShowsCache } from "@/lib/shows-cache";
import type { ShowItem } from "@/lib/shows-recommendations-grok";

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

  // 2. No cache: do not call Grok here (it takes 60+ s and causes 504). Only the 6am cron fills the cache.
  return NextResponse.json(
    {
      error:
        "Recommendations refresh daily at 6am ET. Try again in a few minutes or tap Retry.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
