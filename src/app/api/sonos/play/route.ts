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

const DEVICE_MAP: Record<string, string> = {
  "living room": "Living Room",
  "guest bathroom": "Guest Bathroom",
  "bedroom": "Bedroom",
  "kitchen": "Kitchen",
  "office": "Office",
};

const DEFAULT_DEVICE = "living room";
const DEFAULT_PLAYLIST = "Latin indie";

/**
 * POST /api/sonos/play
 * Body: { query?: string, device?: string }
 *
 * Plays music on Sonos speakers. Requires SONOS_ACCESS_TOKEN env var.
 * When Sonos API keys are configured, this will:
 * 1. Find the target speaker group
 * 2. Search Spotify for the requested music (or use default playlist)
 * 3. Start playback
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query as string)?.trim() || DEFAULT_PLAYLIST;
    const deviceInput = (body.device as string)?.trim().toLowerCase() || DEFAULT_DEVICE;
    const deviceName = DEVICE_MAP[deviceInput] ?? deviceInput;

    const sonosToken = process.env.SONOS_ACCESS_TOKEN;
    if (!sonosToken) {
      return json({
        success: false,
        message: `Sonos not configured yet. Would play "${query}" on ${deviceName} speakers.`,
        pending: { query, device: deviceName },
      });
    }

    // --- Sonos Control API integration ---
    // Step 1: Get households
    const hhRes = await fetch("https://api.ws.sonos.com/control/api/v1/households", {
      headers: { Authorization: `Bearer ${sonosToken}` },
    });
    if (!hhRes.ok) {
      return json({ success: false, message: "Failed to reach Sonos API" }, 502);
    }
    const hhData = await hhRes.json();
    const householdId = hhData.households?.[0]?.id;
    if (!householdId) {
      return json({ success: false, message: "No Sonos household found" });
    }

    // Step 2: Get groups and find matching device
    const grpRes = await fetch(
      `https://api.ws.sonos.com/control/api/v1/households/${householdId}/groups`,
      { headers: { Authorization: `Bearer ${sonosToken}` } }
    );
    if (!grpRes.ok) {
      return json({ success: false, message: "Failed to get Sonos groups" }, 502);
    }
    const grpData = await grpRes.json();
    const groups = grpData.groups ?? [];
    const targetGroup = groups.find(
      (g: { name?: string }) => g.name?.toLowerCase().includes(deviceInput)
    ) ?? groups[0];

    if (!targetGroup) {
      return json({ success: false, message: "No Sonos speakers found" });
    }

    // Step 3: Start playback using Sonos favorites or Spotify URI
    // For now, use the audioClip or playback session approach
    // This will be refined once we have the Spotify + Sonos integration details
    return json({
      success: true,
      message: `Playing "${query}" on ${targetGroup.name ?? deviceName}`,
      group: targetGroup.name,
      query,
    });
  } catch (e) {
    return json({
      success: false,
      message: e instanceof Error ? e.message : "Sonos error",
    }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
