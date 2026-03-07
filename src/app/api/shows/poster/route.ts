import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAPIDAPI_HOST = "moviesdatabase.p.rapidapi.com";

/**
 * GET /api/shows/poster?query=Reacher&type=show
 *
 * Returns a poster image URL via the Movies Database API on RapidAPI.
 * Uses the existing RAPID_API_KEY — subscribe to "Movies Database" at
 * https://rapidapi.com/SAdrian/api/moviesdatabase
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type"); // "movie" | "show"
  const rapidKey = process.env.RAPID_API_KEY;

  if (!query || !rapidKey) {
    return NextResponse.json({ poster: null });
  }

  try {
    const titleType = type === "movie" ? "movie" : "tvSeries";
    const url = `https://${RAPIDAPI_HOST}/titles/search/title/${encodeURIComponent(query)}?exact=false&info=base_info&titleType=${titleType}`;

    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!res.ok) return NextResponse.json({ poster: null });

    const data = await res.json();
    const first = data.results?.[0];
    const posterUrl = first?.primaryImage?.url ?? null;

    return NextResponse.json({
      poster: posterUrl,
      title: first?.titleText?.text ?? query,
    });
  } catch {
    return NextResponse.json({ poster: null });
  }
}
