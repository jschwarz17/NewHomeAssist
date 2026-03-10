import { NextResponse } from "next/server";
import { getShowsCache } from "@/lib/shows-cache";
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
  const apiKey = process.env.XAI_API_KEY;

  // 1. Prefer persistent cache (filled by 6am cron or a previous request)
  const cached = await getShowsCache();
  if (cached && cached.shows.length > 0) {
    return NextResponse.json(
      {
        shows: cached.shows as ShowItem[],
        movies: cached.movies as ShowItem[],
        cachedAt: cached.cachedAt,
        version: cached.version,
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. No cache: return mock data in dev for testing, else 503
  if (process.env.NODE_ENV === "development") {
    const mockShows: ShowItem[] = [
      {
        title: "Severance",
        year: "2022",
        type: "show",
        description: "A man discovers a dark alternate self at his mysterious workplace.",
        genre: "Sci-Fi Thriller",
        country: "USA",
        language: "English",
        streamingService: "Apple TV+",
        tmdbSearchTitle: "Severance",
        trailerSearchQuery: "Severance 2022 Official Trailer",
        mood: "gritty",
        posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/8c/Severance_%28TV_series%29.png",
      },
      {
        title: "The Bear",
        year: "2022",
        type: "show",
        description: "A chef returns to run his family's sandwich shop in Chicago.",
        genre: "Drama",
        country: "USA",
        language: "English",
        streamingService: "Hulu",
        tmdbSearchTitle: "The Bear",
        trailerSearchQuery: "The Bear 2022 Official Trailer",
        mood: "gritty",
        posterUrl: null,
      },
    ];
    const mockMovies: ShowItem[] = [
      {
        title: "Dune: Part Two",
        year: "2024",
        type: "movie",
        description: "Paul Atreides unites with the Fremen to wage war against House Harkonnen.",
        genre: "Sci-Fi",
        country: "USA",
        language: "English",
        streamingService: "Max",
        tmdbSearchTitle: "Dune Part Two",
        trailerSearchQuery: "Dune Part Two 2024 Official Trailer",
        mood: "gritty",
        posterUrl: "https://upload.wikimedia.org/wikipedia/en/2/2f/Dune_Part_Two_poster.jpg",
      },
    ];
    return NextResponse.json(
      { shows: mockShows, movies: mockMovies, cachedAt: Date.now(), version: 0 },
      { headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      error:
        "Recommendations refresh daily at 6am ET. Try again in a few minutes or tap Retry.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
