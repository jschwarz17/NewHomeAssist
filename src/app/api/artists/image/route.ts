import { NextRequest, NextResponse } from "next/server";
import { CURATED_ARTISTS } from "@/lib/curated-artists";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const imageCache = new Map<string, string | null>();

type GrokOutputItem = {
  type: string;
  content?: { type: string; text: string }[];
};

async function fetchFromGrok(
  artistName: string,
  xaiKey: string
): Promise<string | null> {
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
          content: `Find the official artist photo or portrait image for the musician/band "${artistName}". Search for it on Spotify, Last.fm, or official artist sites. Return ONLY the direct URL to the image file (ending in .jpg, .jpeg, .png, or .webp). No explanation, no markdown — just the bare URL on a single line.`,
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

  const match = text.match(/https?:\/\/[^\s"'<>\n]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>\n]*)?/i);
  return match ? match[0] : null;
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
    return NextResponse.json({ image: curatedImage });
  }

  if (!xaiKey) {
    return NextResponse.json({ image: null });
  }

  const cacheKey = `artist:${name.toLowerCase()}`;
  if (imageCache.has(cacheKey)) {
    return NextResponse.json({ image: imageCache.get(cacheKey) ?? null });
  }

  let image: string | null = null;
  try {
    image = await fetchFromGrok(name, xaiKey);
  } catch (err) {
    console.error("[artists/image] fetch error:", err);
  }

  imageCache.set(cacheKey, image);
  return NextResponse.json({ image });
}
