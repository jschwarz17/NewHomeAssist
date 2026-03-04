import { NextResponse } from "next/server";
import { sonosManager } from "@/lib/sonos-manager";
import { ensureSonosReady } from "@/lib/sonos-init";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/**
 * GET /api/sonos/zones
 * Returns all discovered Sonos zones/speakers with name, IP, group, volume.
 */
export async function GET() {
  try {
    await ensureSonosReady();
    const zones = await sonosManager.getZoneInfo();
    return json({ success: true, zones });
  } catch (e) {
    return json({ success: false, message: e instanceof Error ? e.message : "Sonos error", zones: [] }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
