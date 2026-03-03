import { NextResponse } from "next/server";

/**
 * Returns an ephemeral token for the Grok Voice Agent API (wss://api.x.ai/v1/realtime).
 * Use this from the client to connect to the Voice Agent with Ara's voice without exposing XAI_API_KEY.
 *
 * Client flow:
 * 1. POST /api/realtime-token → get ephemeral token
 * 2. Connect to wss://api.x.ai/v1/realtime with Authorization: Bearer <token>
 * 3. Send session.update with session.voice = "Ara" and session.instructions for Ara's personality
 * 4. Stream audio bidirectionally per xAI Voice Agent API docs
 */
const XAI_REALTIME_CLIENT_SECRETS = "https://api.x.ai/v1/realtime/client_secrets";

export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "XAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(XAI_REALTIME_CLIENT_SECRETS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { message: "Failed to get realtime token", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[realtime-token] error:", e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
