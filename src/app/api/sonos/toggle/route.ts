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

/**
 * POST /api/sonos/toggle
 * Body: { device?: string }
 * Toggles play/pause on the specified speaker.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const device = (body.device as string)?.trim();

    await ensureSonosReady();
    const result = await sonosManager.togglePlayback(device);
    return json({ success: true, message: result });
  } catch (e) {
    return json({ success: false, message: e instanceof Error ? e.message : "Sonos error" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
