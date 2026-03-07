import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/shows/poster?query=Reacher&type=show
 *
 * Returns a TMDB poster URL for the given title.
 * Requires TMDB_API_KEY env var (free at themoviedb.org/settings/api).
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type") === "movie" ? "movie" : "tv";
  const apiKey = process.env.TMDB_API_KEY;

  if (!query || !apiKey) {
    return NextResponse.json({ poster: null });
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`
    );
    if (!res.ok) return NextResponse.json({ poster: null });

    const data = await res.json();
    const first = data.results?.[0];
    const posterPath = first?.poster_path;

    return NextResponse.json({
      poster: posterPath ? `https://image.tmdb.org/t/p/w300${posterPath}` : null,
      title: first?.name ?? first?.title ?? query,
      tmdbId: first?.id ?? null,
    });
  } catch {
    return NextResponse.json({ poster: null });
  }
}
