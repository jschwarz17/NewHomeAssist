import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export interface ShowItem {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  streamingService: string;
  posterSearchQuery: string;
  trailerSearchQuery: string;
}

interface Cache {
  shows: ShowItem[];
  movies: ShowItem[];
  cachedAt: number;
}

let cache: Cache | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

const SYSTEM_PROMPT = `You are a movie and TV show recommendation engine. Return ONLY valid JSON, no markdown fences, no explanation.

Return a JSON object with two arrays: "shows" (10 items) and "movies" (10 items).

Content filter: Recommend action, suspense, thriller, or crime shows and movies. Focus on quality storytelling, compelling characters, and strong plots. Include a mix of recent hits and underrated classics. Prioritize titles currently available for streaming in the US.

Each item must have exactly these fields:
- title: string (exact title)
- year: string (release year or range e.g. "2020–2023")
- type: "movie" or "show"
- description: string (2–3 engaging sentences about the plot and why it is worth watching)
- genre: string (e.g. "Action / Thriller")
- streamingService: string (primary US streaming service, e.g. "Netflix", "Prime Video", "Hulu", "Disney+", "Max", "Paramount+", "Peacock", "Apple TV+")
- posterSearchQuery: string (just the title, used for TMDB poster lookup)
- trailerSearchQuery: string (YouTube search query for the official trailer, e.g. "Reacher Season 2 Official Trailer")`;

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_MS) {
    return NextResponse.json(cache, { headers: CORS_HEADERS });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Give me 10 TV show recommendations and 10 movie recommendations.",
          },
        ],
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      throw new Error(`Grok API error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    cache = {
      shows: parsed.shows ?? [],
      movies: parsed.movies ?? [],
      cachedAt: Date.now(),
    };

    return NextResponse.json(cache, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[shows/recommendations] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch recommendations", details: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
