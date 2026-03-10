import { NextRequest, NextResponse } from "next/server";
import { CURATED_ARTISTS } from "@/lib/curated-artists";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const imageCache = new Map<string, string | null>();
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

async function fetchFromSpotify(artistName: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenRes = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!tokenRes?.ok) return null;

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return null;

  const searchRes = await fetchWithTimeout(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!searchRes?.ok) return null;

  const searchData = (await searchRes.json()) as {
    artists?: { items?: Array<{ images?: Array<{ url?: string | null }> }> };
  };

  const firstImageUrl = searchData.artists?.items?.[0]?.images?.[0]?.url;
  return normalizeImageUrl(firstImageUrl ?? null);
}

async function fetchFromDeezer(artistName: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}`,
    { method: "GET" }
  );
  if (!res?.ok) return null;

  const data = (await res.json()) as {
    data?: Array<{
      name?: string;
      picture_xl?: string | null;
      picture_big?: string | null;
      picture_medium?: string | null;
    }>;
  };

  const normalizedTarget = artistName.trim().toLowerCase();
  const bestMatch =
    data.data?.find((artist) => artist.name?.trim().toLowerCase() === normalizedTarget) ??
    data.data?.[0];

  return normalizeImageUrl(
    bestMatch?.picture_xl ?? bestMatch?.picture_big ?? bestMatch?.picture_medium ?? null
  );
}

async function fetchFromWikipedia(artistName: string): Promise<string | null> {
  const searchParams = new URLSearchParams({
    action: "query",
    list: "search",
    format: "json",
    srlimit: "1",
    srsearch: `${artistName} musician`,
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
  artistName: string,
  xaiKey: string
): Promise<string | null> {
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
            content: `Find the official artist photo or portrait image for the musician/band "${artistName}". Search for it on Spotify, Last.fm, or official artist sites. Return ONLY the direct URL to the image file. No explanation, no markdown — just the bare URL on a single line.`,
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

/**
 * GET /api/artists/image?name=ArtistName
 * Uses Grok web search to find artist image URL.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const xaiKey = process.env.XAI_API_KEY;

  if (!name) {
    return NextResponse.json({ image: null });
  }

  const curatedImage =
    CURATED_ARTISTS.find(
      (artist) => artist.name.toLowerCase() === name.toLowerCase()
    )?.imageUrl ?? null;
  if (curatedImage) {
    return NextResponse.json({ image: normalizeImageUrl(curatedImage) });
  }

  const cacheKey = `artist:${name.toLowerCase()}`;
  if (imageCache.has(cacheKey)) {
    return NextResponse.json({ image: imageCache.get(cacheKey) ?? null });
  }

  let image: string | null = null;
  try {
    image = await fetchFromSpotify(name);
  } catch (err) {
    console.error("[artists/image] spotify lookup error:", err);
  }

  if (!image) {
    try {
      image = await fetchFromDeezer(name);
    } catch (err) {
      console.error("[artists/image] deezer lookup error:", err);
    }
  }

  if (!image) {
    try {
      image = await fetchFromWikipedia(name);
    } catch (err) {
      console.error("[artists/image] wikipedia lookup error:", err);
    }
  }

  if (!image && xaiKey) {
    try {
      image = await fetchFromGrok(name, xaiKey);
    } catch (err) {
      console.error("[artists/image] grok lookup error:", err);
    }
  }

  if (image) {
    imageCache.set(cacheKey, image);
  } else {
    imageCache.delete(cacheKey);
  }
  return NextResponse.json({ image });
}
