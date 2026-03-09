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
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const keyParam = req.nextUrl.searchParams.get("key")?.trim();
  const authorized =
    !secret ||
    auth === `Bearer ${secret}` ||
    (keyParam != null && keyParam !== "" && keyParam === secret);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "XAI_API_KEY not set" }, { status: 500 });
  }

  // #region agent log
  fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b86282'},body:JSON.stringify({sessionId:'b86282',location:'warm-shows/route.ts:GET',message:'warm-shows started',data:{hasKey:!!keyParam},timestamp:Date.now(),hypothesisId:'entry'})}).catch(()=>{});
  // #endregion
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
    const errMsg = err instanceof Error ? err.message : String(err);
    // #region agent log
    fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b86282'},body:JSON.stringify({sessionId:'b86282',location:'warm-shows/route.ts:catch',message:'warm-shows error',data:{errorMessage:errMsg.slice(0,500)},timestamp:Date.now(),hypothesisId:'H1-H5'})}).catch(()=>{});
    // #endregion
    console.error("[cron/warm-shows] error:", err);
    return NextResponse.json(
      { error: "Failed to warm shows cache", details: String(err) },
      { status: 500 }
    );
  }
}
