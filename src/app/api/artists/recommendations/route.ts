import { NextResponse } from "next/server";
import { getArtistsCache, setArtistsCache } from "@/lib/artists-cache";
import { fetchArtistsFromGrok } from "@/lib/artists-recommendations-grok";
import type { ArtistItem } from "@/lib/artists-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Re-export for consumers that import from the route
export type { ArtistItem } from "@/lib/artists-recommendations-grok";

export async function GET() {
  // 1. Prefer persistent cache (filled by cron, Postgres, or local file)
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

  // 2. No cache — try fetching on-demand from Grok if API key is available
  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const result = await fetchArtistsFromGrok(apiKey);
      await setArtistsCache({
        artists: result.artists,
        cachedAt: result.cachedAt,
        version: result.version,
      });
      return NextResponse.json(
        {
          artists: result.artists,
          cachedAt: result.cachedAt,
          version: result.version,
        },
        { headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error("[artists/recommendations] on-demand Grok error:", err);
      return NextResponse.json(
        {
          error: "Failed to fetch artist recommendations. Please try again.",
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
