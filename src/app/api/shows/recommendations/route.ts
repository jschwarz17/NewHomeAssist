import { NextResponse } from "next/server";
import {
  CURATED_MOVIES,
  CURATED_SHOWS,
  CURATED_SHOWS_VERSION,
} from "@/lib/curated-shows";
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
  return NextResponse.json(
    {
      shows: CURATED_SHOWS as ShowItem[],
      movies: CURATED_MOVIES as ShowItem[],
      cachedAt: Date.now(),
      version: CURATED_SHOWS_VERSION,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
