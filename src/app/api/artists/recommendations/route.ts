import { NextResponse } from "next/server";
import { CURATED_ARTISTS, CURATED_ARTISTS_VERSION } from "@/lib/curated-artists";
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
  return NextResponse.json(
    {
      artists: CURATED_ARTISTS as ArtistItem[],
      cachedAt: Date.now(),
      version: CURATED_ARTISTS_VERSION,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
