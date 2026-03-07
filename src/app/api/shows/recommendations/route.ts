import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export type ShowMood = "fun" | "gritty" | "quirky" | "funny" | "suspenseful";

export interface ShowItem {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  country: string;
  language: string;
  streamingService: string;
  tmdbSearchTitle: string;
  trailerSearchQuery: string;
  mood: ShowMood;
}

interface Cache {
  shows: ShowItem[];
  movies: ShowItem[];
  cachedAt: number;
}

let cache: Cache | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

const SYSTEM_PROMPT = `You are a movie and TV show recommendation engine. Return ONLY valid JSON, no markdown fences, no explanation.

Return a JSON object with two arrays: "shows" (10 items) and "movies" (10 items).

CRITICAL — ACCURACY RULES (read carefully before responding):
- You MUST only recommend titles that you are 100% certain actually exist and have been publicly released or officially confirmed for release.
- Do NOT invent, hallucinate, or speculate about titles. If you are even slightly unsure a title is real, omit it and pick something you are certain about.
- Every title must be a real, verifiable movie or TV show that exists in databases like IMDB or TMDB.
- Prefer well-known recent hits you have strong knowledge of over obscure or uncertain titles.

CONTENT RULES:
1. Prioritize titles from 2024 and 2025. You may include a small number of confirmed 2023 titles if needed to fill the list. Do NOT include titles whose release date you are uncertain about.
2. Primary genres: action, suspense, thriller, crime. Include exactly 2-3 comedy titles spread across shows and movies combined.
3. All recommendations must be mainstream, broadly entertaining, and non-political. Avoid titles with heavy ideological messaging, social justice themes, or woke content. Focus on storytelling, tension, humor, and character.
4. Prioritize titles currently available for streaming in the US.
5. Each item must have a "mood" tag — choose ONE from: "fun", "gritty", "quirky", "funny", "suspenseful".
   - fun: light, adventurous, crowd-pleasing action or comedy
   - gritty: dark, intense, realistic crime or thriller
   - quirky: offbeat, unconventional, stylized
   - funny: primarily comedy-driven
   - suspenseful: edge-of-seat tension, mystery, psychological
6. Across the combined 20 titles, include exactly 3-4 international titles (non-English language originals). They must be real, confirmed releases you are certain about.

Each item must have exactly these fields:
- title: string (exact official title as it appears on IMDB/TMDB)
- year: string (confirmed release year, e.g. "2024" or "2025")
- type: "movie" or "show"
- description: string (2-3 engaging sentences about the plot and why it is worth watching)
- genre: string (e.g. "Action / Thriller")
- country: string (country of origin, e.g. "USA", "South Korea", "France")
- language: string (original language, e.g. "English", "Korean", "French")
- streamingService: string (primary US streaming service, e.g. "Netflix", "Prime Video", "Hulu", "Disney+", "Max", "Paramount+", "Peacock", "Apple TV+", "Theaters")
- tmdbSearchTitle: string (the exact title to search on TMDB — usually same as title, but use English title if known)
- trailerSearchQuery: string (YouTube search query for the official trailer, e.g. "Warfare 2025 Official Trailer")
- mood: string (one of: "fun", "gritty", "quirky", "funny", "suspenseful")`;

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
              "Give me 10 TV show recommendations and 10 movie recommendations. Only include titles you are absolutely certain are real and exist.",
          },
        ],
        temperature: 0.5,
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
