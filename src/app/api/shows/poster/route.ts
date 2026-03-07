import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAPIDAPI_HOST = "moviesdatabase.p.rapidapi.com";

// Server-side poster cache: key → posterUrl | null
const posterCache = new Map<string, string | null>();

async function searchPosters(
  query: string,
  titleType: string | null,
  rapidKey: string
): Promise<{ url: string | null; year: string | null }[]> {
  const params = new URLSearchParams({
    exact: "false",
    info: "base_info",
    ...(titleType ? { titleType } : {}),
  });

  const url = `https://${RAPIDAPI_HOST}/titles/search/title/${encodeURIComponent(query)}?${params}`;

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": rapidKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const results: { url: string | null; year: string | null }[] = (
    data.results ?? []
  ).map((r: Record<string, unknown>) => {
    const img = r.primaryImage as Record<string, unknown> | undefined;
    const releaseYear = r.releaseYear as Record<string, unknown> | undefined;
    return {
      url: (img?.url as string) ?? null,
      year: releaseYear?.year != null ? String(releaseYear.year) : null,
    };
  });

  return results;
}

function pickBestPoster(
  results: { url: string | null; year: string | null }[],
  targetYear?: string
): string | null {
  const withPosters = results.filter((r) => r.url);
  if (!withPosters.length) return null;

  if (targetYear) {
    const target = parseInt(targetYear, 10);
    // Sort by closeness to target year, favouring exact matches
    withPosters.sort((a, b) => {
      const da = a.year ? Math.abs(parseInt(a.year, 10) - target) : 999;
      const db = b.year ? Math.abs(parseInt(b.year, 10) - target) : 999;
      return da - db;
    });
  }

  return withPosters[0].url!;
}

/**
 * GET /api/shows/poster?query=Reacher&type=show&year=2025
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type"); // "movie" | "show"
  const year = req.nextUrl.searchParams.get("year") ?? undefined;
  const rapidKey = process.env.RAPID_API_KEY;

  if (!query || !rapidKey) {
    return NextResponse.json({ poster: null });
  }

  const cacheKey = `${type}:${query}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  try {
    const titleType = type === "movie" ? "movie" : "tvSeries";

    // Primary attempt: with titleType filter
    let results = await searchPosters(query, titleType, rapidKey);
    let poster = pickBestPoster(results, year);

    // Fallback 1: drop the titleType restriction
    if (!poster) {
      results = await searchPosters(query, null, rapidKey);
      poster = pickBestPoster(results, year);
    }

    // Fallback 2: try just the first word(s) of the title if it's multi-word
    if (!poster) {
      const shortQuery = query.split(/\s+/).slice(0, 2).join(" ");
      if (shortQuery !== query) {
        results = await searchPosters(shortQuery, titleType, rapidKey);
        poster = pickBestPoster(results, year);
      }
    }

    posterCache.set(cacheKey, poster);
    return NextResponse.json({ poster });
  } catch {
    posterCache.set(cacheKey, null);
    return NextResponse.json({ poster: null });
  }
}
