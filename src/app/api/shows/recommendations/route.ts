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
  posterSearchQuery: string;
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

STRICT RULES:
1. Only include titles released in 2025 or 2026. Do NOT include anything from 2024 or earlier.
2. Primary genres: action, suspense, thriller, crime. Include exactly 2-3 comedy titles spread across shows and movies combined.
3. All recommendations must be mainstream, broadly entertaining, and non-political. Avoid titles with heavy ideological messaging, social justice themes, or woke content. Focus on storytelling, tension, humor, and character.
4. Prioritize titles currently available for streaming in the US.
5. Each item must have a "mood" tag that best describes it — choose ONE from: "fun", "gritty", "quirky", "funny", "suspenseful".
   - fun: light, adventurous, crowd-pleasing action or comedy
   - gritty: dark, intense, realistic crime or thriller
   - quirky: offbeat, unconventional, stylized
   - funny: primarily comedy-driven
   - suspenseful: edge-of-seat tension, mystery, psychological

6. Across the combined 20 titles (10 shows + 10 movies), include exactly 3-4 international titles (non-English language originals, e.g. from South Korea, France, Spain, Germany, Japan, etc.). Spread them between shows and movies. They must still meet all other rules (2025/2026, action/thriller/crime primary, non-woke, mood tag).

Each item must have exactly these fields:
- title: string (exact title in its original or most well-known English release title)
- year: string (release year, e.g. "2025" or "2026")
- type: "movie" or "show"
- description: string (2-3 engaging sentences about the plot and why it is worth watching)
- genre: string (e.g. "Action / Thriller")
- country: string (country of origin, e.g. "USA", "South Korea", "France")
- language: string (original language, e.g. "English", "Korean", "French")
- streamingService: string (primary US streaming service, e.g. "Netflix", "Prime Video", "Hulu", "Disney+", "Max", "Paramount+", "Peacock", "Apple TV+", "Theaters")
- posterSearchQuery: string (just the title, used for poster lookup)
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
              "Give me 10 TV show recommendations and 10 movie recommendations from 2025 or 2026 only.",
          },
        ],
        temperature: 0.75,
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
