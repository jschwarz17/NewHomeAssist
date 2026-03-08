import { NextRequest, NextResponse } from "next/server";
import { initShowsCacheTable, setShowsCache } from "@/lib/shows-cache";
import { fetchRecommendationsFromGrok } from "@/lib/shows-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pre-fetches Ara recommendations into Postgres (same job that runs at 6am ET).
 * - Vercel Cron: sends Authorization: Bearer CRON_SECRET.
 * - Manual test: open in browser or curl with ?key=YOUR_CRON_SECRET (takes 1–2 min).
 * After it returns 200, refresh the Shows page to see data.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const keyParam = req.nextUrl.searchParams.get("key");
  const authorized =
    !secret ||
    auth === `Bearer ${secret}` ||
    (keyParam !== null && keyParam === secret);
  if (!authorized) {
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
