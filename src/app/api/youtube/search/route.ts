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

/**
 * POST /api/youtube/search
 * Body: { query: string }
 *
 * If YOUTUBE_API_KEY is set, uses YouTube Data API to find the best matching video.
 * Otherwise, returns a YouTube search URL that opens in the browser.
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
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        const video = data.items?.[0];
        if (video) {
          const videoId = video.id?.videoId;
          const title = video.snippet?.title ?? query;
          return json({
            success: true,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
            title,
            videoId,
          });
        }
      }
    }

    // Fallback: return a YouTube search URL (works without API key)
    const searchPageUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    return json({
      success: true,
      videoUrl: searchPageUrl,
      title: query,
      isSearch: true,
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
