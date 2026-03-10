import { NextRequest, NextResponse } from "next/server";
import { CURATED_MOVIES, CURATED_SHOWS } from "@/lib/curated-shows";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Server-side poster cache: cacheKey → posterUrl | null
const posterCache = new Map<string, string | null>();
const LOOKUP_TIMEOUT_MS = 5500;

type GrokOutputItem = {
  type: string;
  content?: { type: string; text: string }[];
};

function normalizeImageUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const withProtocol = raw.startsWith("//") ? `https:${raw}` : raw;

  try {
    const url = new URL(withProtocol);
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = LOOKUP_TIMEOUT_MS
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractLikelyImageUrl(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s"'<>()[\]{}]+/gi) ?? [];
  if (matches.length === 0) return null;

  const preferred = matches.find((candidate) =>
    /\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?|$)/i.test(candidate)
  );

  const chosen = preferred ?? matches[0];
  if (!chosen) return null;
  return normalizeImageUrl(chosen.replace(/[),.;!?]+$/, ""));
}

// ── Sources ───────────────────────────────────────────────────────────────────

async function fetchFromTmdb(
  query: string,
  type: string,
  year: string | undefined,
  tmdbApiKey: string
): Promise<string | null> {
  const isMovie = type === "movie";
  const endpoint = isMovie ? "movie" : "tv";
  const params = new URLSearchParams({
    api_key: tmdbApiKey,
    query,
    include_adult: "false",
    page: "1",
  });

  if (year && /^\d{4}$/.test(year)) {
    params.set(isMovie ? "primary_release_year" : "first_air_date_year", year);
  }

  const res = await fetchWithTimeout(
    `https://api.themoviedb.org/3/search/${endpoint}?${params}`,
    { method: "GET" }
  );
  if (!res?.ok) return null;

  const data = (await res.json()) as {
    results?: Array<{ poster_path?: string | null }>;
  };
  const posterPath = data.results?.find((item) => item.poster_path)?.poster_path;
  return posterPath ? normalizeImageUrl(`https://image.tmdb.org/t/p/w500${posterPath}`) : null;
}

async function fetchFromTvMaze(query: string, year: string | undefined): Promise<string | null> {
  const res = await fetchWithTimeout(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    { method: "GET" }
  );
  if (!res?.ok) return null;

  const data = (await res.json()) as Array<{
    score?: number;
    show?: {
      premiered?: string | null;
      image?: { original?: string | null; medium?: string | null };
    };
  }>;
  if (!Array.isArray(data) || data.length === 0) return null;

  const normalizedYear = year && /^\d{4}$/.test(year) ? year : null;
  const candidate =
    data.find((item) => {
      if (!normalizedYear) return true;
      const premieredYear = item.show?.premiered?.slice(0, 4) ?? null;
      return premieredYear === normalizedYear;
    }) ?? data[0];

  return normalizeImageUrl(candidate.show?.image?.original ?? candidate.show?.image?.medium ?? null);
}

async function fetchFromOmdb(
  query: string,
  year: string | undefined,
  omdbApiKey: string
): Promise<string | null> {
  const params = new URLSearchParams({
    apikey: omdbApiKey,
    t: query,
  });
  if (year && /^\d{4}$/.test(year)) {
    params.set("y", year);
  }

  const res = await fetchWithTimeout(`https://www.omdbapi.com/?${params}`, {
    method: "GET",
  });
  if (!res?.ok) return null;

  const data = (await res.json()) as {
    Response?: string;
    Poster?: string;
  };

  if (data.Response === "False") return null;
  return normalizeImageUrl(data.Poster && data.Poster !== "N/A" ? data.Poster : null);
}

async function fetchFromWikipedia(
  query: string,
  type: string,
  year: string | undefined
): Promise<string | null> {
  const mediaHint = type === "movie" ? "film" : "TV series";
  const searchQuery = [query, year, mediaHint].filter(Boolean).join(" ");
  const searchParams = new URLSearchParams({
    action: "query",
    list: "search",
    format: "json",
    srlimit: "1",
    srsearch: searchQuery,
  });

  const searchRes = await fetchWithTimeout(
    `https://en.wikipedia.org/w/api.php?${searchParams}`,
    { method: "GET" }
  );
  if (!searchRes?.ok) return null;

  const searchData = (await searchRes.json()) as {
    query?: { search?: Array<{ title?: string }> };
  };
  const title = searchData.query?.search?.[0]?.title;
  if (!title) return null;

  const summaryRes = await fetchWithTimeout(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { method: "GET" }
  );
  if (!summaryRes?.ok) return null;

  const summaryData = (await summaryRes.json()) as {
    originalimage?: { source?: string };
    thumbnail?: { source?: string };
  };

  return normalizeImageUrl(summaryData.originalimage?.source ?? summaryData.thumbnail?.source ?? null);
}

async function fetchFromGrok(
  query: string,
  type: string,
  year: string | undefined,
  xaiKey: string
): Promise<string | null> {
  const mediaType = type === "movie" ? "movie" : "TV show";
  const yearStr = year ? ` (${year})` : "";

  const res = await fetchWithTimeout(
    "https://api.x.ai/v1/responses",
    {
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
            content: `Find the official portrait/vertical poster image for the ${mediaType} "${query}"${yearStr}. Use web search to find the direct image URL. Return ONLY the direct URL to the image file. No explanation, no markdown — just the bare URL on a single line.`,
          },
        ],
      }),
    },
    LOOKUP_TIMEOUT_MS
  );

  if (!res?.ok) return null;

  const data = await res.json();
  const messageItem = (data.output as GrokOutputItem[] | undefined)?.find(
    (o) => o.type === "message"
  );
  const text =
    messageItem?.content?.find((c) => c.type === "output_text")?.text?.trim() ?? "";

  return extractLikelyImageUrl(text);
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
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const omdbApiKey = process.env.OMDB_API_KEY ?? "thewdb";

  if (!query) {
    return NextResponse.json({ poster: null });
  }

  const curatedPoster =
    [...CURATED_SHOWS, ...CURATED_MOVIES].find((item) => {
      const normalizedQuery = query.trim().toLowerCase();
      return (
        item.title.toLowerCase() === normalizedQuery ||
        item.tmdbSearchTitle.toLowerCase() === normalizedQuery
      );
    })?.posterUrl ?? null;
  if (curatedPoster) {
    return NextResponse.json({ poster: normalizeImageUrl(curatedPoster) });
  }

  const cacheKey = `grok:${type}:${query}:${year ?? ""}`;
  if (posterCache.has(cacheKey)) {
    return NextResponse.json({ poster: posterCache.get(cacheKey) ?? null });
  }

  let poster: string | null = null;

  if (type !== "movie") {
    try {
      poster = await fetchFromTvMaze(query, year);
    } catch (err) {
      console.error("[poster] tvmaze lookup error:", err);
    }
  }

  if (!poster && type === "movie" && omdbApiKey) {
    try {
      poster = await fetchFromOmdb(query, year, omdbApiKey);
    } catch (err) {
      console.error("[poster] omdb lookup error:", err);
    }
  }

  if (!poster && tmdbApiKey) {
    try {
      poster = await fetchFromTmdb(query, type, year, tmdbApiKey);
    } catch (err) {
      console.error("[poster] tmdb lookup error:", err);
    }
  }

  if (!poster) {
    try {
      poster = await fetchFromWikipedia(query, type, year);
    } catch (err) {
      console.error("[poster] wikipedia lookup error:", err);
    }
  }

  if (!poster && xaiKey) {
    try {
      poster = await fetchFromGrok(query, type, year, xaiKey);
    } catch (err) {
      console.error("[poster] grok lookup error:", err);
    }
  }

  if (poster) {
    posterCache.set(cacheKey, poster);
  } else {
    posterCache.delete(cacheKey);
  }
  return NextResponse.json({ poster });
}
