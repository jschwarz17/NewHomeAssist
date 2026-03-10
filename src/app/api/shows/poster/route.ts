import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Server-side poster cache: cacheKey → posterUrl | null
const posterCache = new Map<string, string | null>();

type GrokOutputItem = {
  type: string;
  content?: { type: string; text: string }[];
};

// ── Grok web search for poster images ────────────────────────────────────────

async function fetchFromGrok(
  query: string,
  type: string,
  year: string | undefined,
  xaiKey: string
): Promise<string | null> {
  const mediaType = type === "movie" ? "movie" : "TV show";
  const yearStr = year ? ` (${year})` : "";

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${xaiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "user",
          content: `Find the official portrait/vertical poster image for the ${mediaType} "${query}"${yearStr}. Use web search to find the direct image URL. Return ONLY the direct URL to the image file (ending in .jpg, .jpeg, .png, or .webp). No explanation, no markdown — just the bare URL on a single line.`,
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const messageItem = (data.output as GrokOutputItem[] | undefined)?.find(
    (o) => o.type === "message"
  );
  const text =
    messageItem?.content?.find((c) => c.type === "output_text")?.text?.trim() ?? "";

  // Extract the first image URL from the response
  const match = text.match(/https?:\/\/[^\s"'<>\n]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>\n]*)?/i);
  return match ? match[0] : null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/shows/poster?query=Severance&type=show&year=2025
 *
 * Uses Grok web search to find poster image URLs.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type") ?? "movie";
  const year = req.nextUrl.searchParams.get("year") ?? undefined;
  const xaiKey = process.env.XAI_API_KEY;

  if (!query || !xaiKey) {
    return NextResponse.json({ poster: null });
  }

  const cacheKey = `grok:${type}:${query}:${year ?? ""}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  let poster: string | null = null;

  try {
    poster = await fetchFromGrok(query, type, year, xaiKey);
  } catch (err) {
    console.error("[poster] fetch error:", err);
  }

  posterCache.set(cacheKey, poster);
  return NextResponse.json({ poster });
}
