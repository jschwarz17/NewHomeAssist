import { NextRequest, NextResponse } from "next/server";
import { CURATED_MOVIES, CURATED_SHOWS } from "@/lib/curated-shows";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/**
 * POST /api/youtube/search
 * Body: { query: string }
 *
 * Returns a videoId for embedding.
 * Uses YouTube Data API (needs YOUTUBE_API_KEY env var).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query as string)?.trim();
    if (!query) {
      return json({ success: false, message: "Missing query" }, 400);
    }

    const normalizedQuery = query.toLowerCase();
    const curatedMatch = [...CURATED_SHOWS, ...CURATED_MOVIES].find((item) =>
      normalizedQuery.includes(item.title.toLowerCase())
    );
    if (curatedMatch?.trailerVideoId) {
      return json({
        success: true,
        videoId: curatedMatch.trailerVideoId,
        title: `${curatedMatch.title} — Trailer`,
      });
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
        // fall through
      }
    }

    return json({
      success: false,
      message: apiKey
        ? "YouTube search returned no results"
        : "YouTube API key not configured. Add YOUTUBE_API_KEY in Vercel env vars.",
    });
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
