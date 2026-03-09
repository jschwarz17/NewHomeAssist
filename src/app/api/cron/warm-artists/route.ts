import { NextRequest, NextResponse } from "next/server";
import { initArtistsCacheTable, setArtistsCache } from "@/lib/artists-cache";
import { fetchArtistsFromGrok } from "@/lib/artists-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pre-fetches indie rock artist recommendations into Postgres.
 * - Vercel Cron: sends Authorization: Bearer CRON_SECRET.
 * - Manual test: open in browser or curl with ?key=YOUR_CRON_SECRET (takes 1–2 min).
 * After it returns 200, refresh the Artists page to see data.
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

  try {
    await initArtistsCacheTable();
    const result = await fetchArtistsFromGrok(apiKey);
    await setArtistsCache({
      artists: result.artists,
      cachedAt: result.cachedAt,
      version: result.version,
    });
    return NextResponse.json({ ok: true, cachedAt: result.cachedAt });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[cron/warm-artists] error:", err);
    return NextResponse.json(
      { error: "Failed to warm artists cache", details: String(err) },
      { status: 500 }
    );
  }
}
