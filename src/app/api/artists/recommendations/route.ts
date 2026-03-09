import { NextResponse } from "next/server";
import { getArtistsCache } from "@/lib/artists-cache";
import type { ArtistItem } from "@/lib/artists-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Re-export for consumers that import from the route
export type { ArtistItem } from "@/lib/artists-recommendations-grok";

export async function GET() {
  // 1. Prefer persistent cache (filled by cron or a previous request)
  const cached = await getArtistsCache();
  if (cached && cached.artists.length > 0) {
    return NextResponse.json(
      {
        artists: cached.artists as ArtistItem[],
        cachedAt: cached.cachedAt,
        version: cached.version,
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. No cache: do not call Grok here (it takes 60+ s and causes 504). Only the cron fills the cache.
  return NextResponse.json(
    {
      error:
        "Artists refresh daily. Try again in a few minutes or tap Retry.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
