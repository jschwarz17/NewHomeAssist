import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Server-side poster cache: cacheKey → posterUrl | null
const posterCache = new Map<string, string | null>();

// ── TMDB ──────────────────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

async function fetchFromTmdb(
  query: string,
  type: string,
  year: string | undefined,
  apiKey: string
): Promise<string | null> {
  const isMovie = type === "movie";
  const endpoint = isMovie ? "search/movie" : "search/tv";
  const yearParam = isMovie
    ? year ? `&year=${year}` : ""
    : year ? `&first_air_date_year=${year}` : "";

  const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false${yearParam}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const results: { poster_path?: string | null; release_date?: string; first_air_date?: string }[] =
    data.results ?? [];

  // Pick the result with a poster, preferring the year closest to the target
  const withPosters = results.filter((r) => r.poster_path);
  if (!withPosters.length) {
    // Retry without year restriction if we got nothing
    if (year) return fetchFromTmdb(query, type, undefined, apiKey);
    return null;
  }

  if (year) {
    const target = parseInt(year, 10);
    withPosters.sort((a, b) => {
      const dateA = isMovie ? a.release_date : a.first_air_date;
      const dateB = isMovie ? b.release_date : b.first_air_date;
      const ya = dateA ? Math.abs(parseInt(dateA.slice(0, 4), 10) - target) : 999;
      const yb = dateB ? Math.abs(parseInt(dateB.slice(0, 4), 10) - target) : 999;
      return ya - yb;
    });
  }

  const poster = withPosters[0].poster_path!;
  return `${TMDB_IMAGE_BASE}${poster}`;
}

// ── RapidAPI Movies Database (fallback) ───────────────────────────────────────

const RAPIDAPI_HOST = "moviesdatabase.p.rapidapi.com";

async function searchRapidApi(
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
  return (data.results ?? []).map((r: Record<string, unknown>) => {
    const img = r.primaryImage as Record<string, unknown> | undefined;
    const releaseYear = r.releaseYear as Record<string, unknown> | undefined;
    return {
      url: (img?.url as string) ?? null,
      year: releaseYear?.year != null ? String(releaseYear.year) : null,
    };
  });
}

async function fetchFromRapidApi(
  query: string,
  type: string,
  year: string | undefined,
  rapidKey: string
): Promise<string | null> {
  const titleType = type === "movie" ? "movie" : "tvSeries";

  let results = await searchRapidApi(query, titleType, rapidKey);
  // Fallback: no titleType filter
  if (!results.some((r) => r.url)) {
    results = await searchRapidApi(query, null, rapidKey);
  }

  const withPosters = results.filter((r) => r.url);
  if (!withPosters.length) return null;

  if (year) {
    const target = parseInt(year, 10);
    withPosters.sort((a, b) => {
      const da = a.year ? Math.abs(parseInt(a.year, 10) - target) : 999;
      const db = b.year ? Math.abs(parseInt(b.year, 10) - target) : 999;
      return da - db;
    });
  }

  return withPosters[0].url!;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/shows/poster?query=Reacher&type=show&year=2024
 *
 * Tries TMDB first (TMDB_API_KEY), falls back to RapidAPI Movies Database.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type") ?? "movie";
  const year = req.nextUrl.searchParams.get("year") ?? undefined;
  const tmdbKey = process.env.TMDB_API_KEY;
  const rapidKey = process.env.RAPID_API_KEY;

  if (!query || (!tmdbKey && !rapidKey)) {
    return NextResponse.json({ poster: null });
  }

  const cacheKey = `${type}:${query}:${year ?? ""}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  let poster: string | null = null;

  try {
    if (tmdbKey) {
      poster = await fetchFromTmdb(query, type, year, tmdbKey);
    }

    // Fallback to RapidAPI if TMDB didn't return anything
    if (!poster && rapidKey) {
      poster = await fetchFromRapidApi(query, type, year, rapidKey);
    }
  } catch (err) {
    console.error("[poster] fetch error:", err);
  }

  posterCache.set(cacheKey, poster);
  return NextResponse.json({ poster });
}
