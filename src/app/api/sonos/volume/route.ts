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
 * POST /api/sonos/volume
 * Body: { volume: number (0-100), device?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const volume = body.volume as number;
    const device = (body.device as string)?.trim();

    if (volume === undefined || typeof volume !== "number") {
      return json({ success: false, message: "Missing 'volume' (0-100)" }, 400);
    }

    await ensureSonosReady();
    const result = await sonosManager.setVolume(volume, device);
    return json({ success: true, message: result });
  } catch (e) {
    return json({ success: false, message: e instanceof Error ? e.message : "Sonos error" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
