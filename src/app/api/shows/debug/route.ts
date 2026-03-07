import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const tmdbKey = process.env.TMDB_API_KEY;
  const rapidKey = process.env.RAPID_API_KEY;

  const result: Record<string, unknown> = {
    env: {
      hasTmdbKey: !!tmdbKey,
      tmdbKeyPrefix: tmdbKey ? tmdbKey.slice(0, 6) + "..." : null,
      hasRapidKey: !!rapidKey,
      rapidKeyPrefix: rapidKey ? rapidKey.slice(0, 6) + "..." : null,
    },
    tmdbTest: null,
    rapidTest: null,
  };

  // Test TMDB with a well-known title
  if (tmdbKey) {
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${tmdbKey}&query=Severance&include_adult=false`
      );
      const d = await r.json();
      result.tmdbTest = {
        status: r.status,
        resultCount: d.results?.length ?? 0,
        firstPosterPath: d.results?.[0]?.poster_path ?? null,
        firstTitle: d.results?.[0]?.name ?? null,
      };
    } catch (e) {
      result.tmdbTest = { error: String(e) };
    }
  }

  // Test RapidAPI with a well-known title
  if (rapidKey) {
    try {
      const r = await fetch(
        `https://moviesdatabase.p.rapidapi.com/titles/search/title/Severance?exact=false&info=base_info&titleType=tvSeries`,
        {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": "moviesdatabase.p.rapidapi.com",
          },
        }
      );
      const d = await r.json();
      const first = d.results?.[0];
      result.rapidTest = {
        status: r.status,
        resultCount: d.results?.length ?? 0,
        firstTitle: first?.titleText?.text ?? null,
        firstPosterUrl: first?.primaryImage?.url ?? null,
      };
    } catch (e) {
      result.rapidTest = { error: String(e) };
    }
  }

  return NextResponse.json(result);
}
