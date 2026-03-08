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

type GrokOutputItem = {
  type: string;
  content?: { type: string; text: string }[];
};

// ── 1. Streaming Availability API ─────────────────────────────────────────────

async function fetchFromStreamingAvailability(
  query: string,
  type: string,
  year: string | undefined,
  rapidKey: string
): Promise<string | null> {
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

  if (!res.ok) return null;

  const data = await res.json();
  const shows: SAShow[] = Array.isArray(data) ? data : (data.shows ?? []);
  if (!shows.length) return null;

  let best = shows[0];
  if (year && shows.length > 1) {
    const target = parseInt(year, 10);
    best = shows.reduce((acc, cur) => {
      const ay = acc.releaseYear ?? acc.firstAirYear ?? 0;
      const cy = cur.releaseYear ?? cur.firstAirYear ?? 0;
      return Math.abs(cy - target) < Math.abs(ay - target) ? cur : acc;
    });
  }

  const candidate =
    best.imageSet?.verticalPoster?.w480 ??
    best.imageSet?.verticalPoster?.w360 ??
    best.imageSet?.verticalPoster?.w240 ??
    null;

  // Skip title-card placeholders (generated for titles with no real artwork)
  if (!candidate || candidate.includes("no_poster") || candidate.includes("placeholder")) {
    return null;
  }
  return candidate;
}

// ── 2. Grok web search fallback ───────────────────────────────────────────────

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
          content: `Find the official portrait/vertical poster image for the ${mediaType} "${query}"${yearStr}. Search for it on TMDB, IMDb, or an official streaming service. Return ONLY the direct URL to the image file (ending in .jpg, .jpeg, .png, or .webp). No explanation, no markdown — just the bare URL on a single line.`,
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
 * 1. Streaming Availability API (cdn.movieofthenight.com — stable)
 * 2. Grok web search fallback — finds poster URL live when SA has no artwork
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const type = req.nextUrl.searchParams.get("type") ?? "movie";
  const year = req.nextUrl.searchParams.get("year") ?? undefined;
  const rapidKey = process.env.RAPID_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  if (!query || (!rapidKey && !xaiKey)) {
    return NextResponse.json({ poster: null });
  }

  const cacheKey = `sa2:${type}:${query}:${year ?? ""}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  let poster: string | null = null;

  try {
    // 1. Streaming Availability — fast, stable CDN URLs
    if (rapidKey) {
      poster = await fetchFromStreamingAvailability(query, type, year, rapidKey);
    }
    // #region agent log
    await fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a583'},body:JSON.stringify({sessionId:'a6a583',location:'poster/route.ts:afterSA',message:'SA result',data:{query,type,year,saResult:poster,hasRapidKey:!!rapidKey},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // 2. Grok live web search — used only when SA has no artwork
    if (!poster && xaiKey) {
      poster = await fetchFromGrok(query, type, year, xaiKey);
    }
    // #region agent log
    await fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a583'},body:JSON.stringify({sessionId:'a6a583',location:'poster/route.ts:final',message:'Final poster result',data:{query,type,year,finalPoster:poster,hasXaiKey:!!xaiKey},timestamp:Date.now(),hypothesisId:'D-E'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    console.error("[poster] fetch error:", err);
  }

  posterCache.set(cacheKey, poster);
  return NextResponse.json({ poster });
}
