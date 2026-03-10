import { NextResponse } from "next/server";
import { CURATED_ARTISTS } from "@/lib/curated-artists";
import type { ArtistItem } from "@/lib/artists-recommendations-grok";
import { fetchArtistsFromGrok } from "@/lib/artists-recommendations-grok";
import { getArtistsCache, initArtistsCacheTable, setArtistsCache } from "@/lib/artists-cache";
import {
  ARTISTS_ROUTE_VERSION,
  buildArtistsResult,
  hasCompleteArtistCount,
  mergeArtistSources,
} from "@/lib/artists-recommendations-utils";

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
  const fallback = buildArtistsResult({
    artists: CURATED_ARTISTS as ArtistItem[],
    cachedAt: Date.now(),
    version: ARTISTS_ROUTE_VERSION,
  });

  let liveError: string | null = null;

  try {
    await initArtistsCacheTable();
  } catch {
    // Cache table creation is best-effort.
  }

  const freshCache = buildArtistsResult((await getArtistsCache()) ?? {});
  if (hasCompleteArtistCount(freshCache)) {
    return NextResponse.json(
      {
        ...freshCache,
        source: "cache",
      },
      { headers: CORS_HEADERS }
    );
  }

  const staleCache = buildArtistsResult(
    (await getArtistsCache({ allowStale: true })) ?? {}
  );

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const live = buildArtistsResult(await fetchArtistsFromGrok(apiKey));
      const merged = mergeArtistSources([live, freshCache, staleCache, fallback]);

      if (merged.artists.length > 0) {
        try {
          await setArtistsCache({
            artists: merged.artists,
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
          },
          { headers: CORS_HEADERS }
        );
      }
    } catch (error) {
      liveError = error instanceof Error ? error.message : String(error);
    }
  }

  const mergedFallback = mergeArtistSources([freshCache, staleCache, fallback]);

  return NextResponse.json(
    {
      ...mergedFallback,
      source: staleCache.artists.length ? "stale-cache" : "fallback",
      notice: liveError
        ? `Live refresh failed, so Ara is showing the last good recent artists instead. ${liveError}`
        : undefined,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
