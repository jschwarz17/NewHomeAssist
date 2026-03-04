import { NextRequest, NextResponse } from "next/server";
import { sonosManager } from "@/lib/sonos-manager";
import { ensureSonosReady } from "@/lib/sonos-init";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

const DEFAULT_PLAYLIST = "Latin indie";
const DEFAULT_DEVICE = "living room";

/**
 * POST /api/sonos/play
 * Body: { query?: string, device?: string, uri?: string }
 *
 * If `uri` is provided, plays that URI directly.
 * Otherwise resumes playback (or reports what would play with the query).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query as string)?.trim() || DEFAULT_PLAYLIST;
    const device = (body.device as string)?.trim() || DEFAULT_DEVICE;
    const uri = (body.uri as string)?.trim();

    await ensureSonosReady();

    if (uri) {
      const result = await sonosManager.playUri(uri, device);
      return json({ success: true, message: result, query, device });
    }

    const result = await sonosManager.play(device);
    return json({ success: true, message: `${result} — "${query}"`, query, device });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sonos error";
    if (msg.includes("not initialized") || msg.includes("discovery failed")) {
      return json({
        success: false,
        message: `Sonos not available on this server. Set SONOS_DEVICE_IP to a speaker IP when running locally. Requested: "${(await req.clone().json().catch(() => ({}))).query || DEFAULT_PLAYLIST}" on ${(await req.clone().json().catch(() => ({}))).device || DEFAULT_DEVICE}`,
      });
    }
    return json({ success: false, message: msg }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
