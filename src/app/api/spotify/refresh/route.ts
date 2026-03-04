import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * POST /api/spotify/refresh
 * Body: { refresh_token: string }
 * Returns new access_token and expires_at.
 */
export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json();
  if (!refresh_token) {
    return NextResponse.json({ error: "Missing refresh_token" }, { status: 400, headers: CORS_HEADERS });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: err }, { status: 502, headers: CORS_HEADERS });
  }

  const data = await tokenRes.json();
  return NextResponse.json(
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
