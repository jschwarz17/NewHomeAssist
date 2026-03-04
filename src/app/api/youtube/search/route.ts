import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

const INVIDIOUS_INSTANCES = [
  "https://vid.puffyan.us",
  "https://invidious.fdn.fr",
  "https://iv.ggtyler.dev",
];

async function searchInvidious(query: string): Promise<{ videoId: string; title: string } | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const results = await res.json();
      const video = results?.[0];
      if (video?.videoId) {
        return { videoId: video.videoId, title: video.title ?? query };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * POST /api/youtube/search
 * Body: { query: string }
 *
 * Returns a videoId for embedding. Tries YouTube Data API first (if key set),
 * then falls back to free Invidious API search.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query as string)?.trim();
    if (!query) {
      return json({ success: false, message: "Missing query" }, 400);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (apiKey) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
        const res = await fetch(searchUrl);
        if (res.ok) {
          const data = await res.json();
          const video = data.items?.[0];
          if (video?.id?.videoId) {
            return json({
              success: true,
              videoId: video.id.videoId,
              title: video.snippet?.title ?? query,
            });
          }
        }
      } catch {
        // fall through to Invidious
      }
    }

    const result = await searchInvidious(query);
    if (result) {
      return json({ success: true, videoId: result.videoId, title: result.title });
    }

    return json({ success: false, message: "No video found" });
  } catch (e) {
    return json({
      success: false,
      message: e instanceof Error ? e.message : "YouTube error",
    }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
