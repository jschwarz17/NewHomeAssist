import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Server-side poster cache: cacheKey → posterUrl | null
const posterCache = new Map<string, string | null>();

type SAShow = {
  releaseYear?: number;
  firstAirYear?: number;
  imageSet?: {
    verticalPoster?: { w480?: string; w360?: string; w240?: string };
  };
};

/**
 * GET /api/shows/poster?query=Reacher&type=show&year=2025
 *
 * Uses the Streaming Availability API (streaming-availability.p.rapidapi.com).
 * Returns stable cdn.movieofthenight.com poster URLs — no 404 issues.
 * Subscribe free (100 req/day) at:
 *   https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type") ?? "movie";
  const year = req.nextUrl.searchParams.get("year") ?? undefined;
  const rapidKey = process.env.RAPID_API_KEY;

  if (!query || !rapidKey) {
    return NextResponse.json({ poster: null });
  }

  const cacheKey = `sa:${type}:${query}:${year ?? ""}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  let poster: string | null = null;

  try {
    const showType = type === "movie" ? "movie" : "series";
    const params = new URLSearchParams({
      title: query,
      country: "us",
      show_type: showType,
      output_language: "en",
    });
    const url = `https://streaming-availability.p.rapidapi.com/shows/search/title?${params}`;

    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": "streaming-availability.p.rapidapi.com",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const shows: SAShow[] = Array.isArray(data) ? data : (data.shows ?? []);

      if (shows.length) {
        // Pick the result whose year is closest to the target year
        let best = shows[0];
        if (year && shows.length > 1) {
          const target = parseInt(year, 10);
          best = shows.reduce((acc, cur) => {
            const ay = acc.releaseYear ?? acc.firstAirYear ?? 0;
            const cy = cur.releaseYear ?? cur.firstAirYear ?? 0;
            return Math.abs(cy - target) < Math.abs(ay - target) ? cur : acc;
          });
        }
        poster =
          best.imageSet?.verticalPoster?.w480 ??
          best.imageSet?.verticalPoster?.w360 ??
          best.imageSet?.verticalPoster?.w240 ??
          null;
      }
    } else {
      console.error(`[poster] Streaming Availability API error: ${res.status}`);
    }
  } catch (err) {
    console.error("[poster] fetch error:", err);
  }

  posterCache.set(cacheKey, poster);
  return NextResponse.json({ poster });
}
