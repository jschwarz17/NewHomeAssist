import { NextRequest, NextResponse } from "next/server";
import { initShowsCacheTable, setShowsCache } from "@/lib/shows-cache";
import { fetchRecommendationsFromGrok } from "@/lib/shows-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by Vercel Cron at 6am UTC daily. Pre-fetches Ara recommendations into Postgres
 * so the app always has instant data when users open it.
 * Secured by CRON_SECRET (Vercel sends it in Authorization header).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "XAI_API_KEY not set" }, { status: 500 });
  }

  try {
    await initShowsCacheTable();
    const result = await fetchRecommendationsFromGrok(apiKey);
    await setShowsCache({
      shows: result.shows,
      movies: result.movies,
      cachedAt: result.cachedAt,
      version: result.version,
    });
    return NextResponse.json({ ok: true, cachedAt: result.cachedAt });
  } catch (err) {
    console.error("[cron/warm-shows] error:", err);
    return NextResponse.json(
      { error: "Failed to warm shows cache", details: String(err) },
      { status: 500 }
    );
  }
}
