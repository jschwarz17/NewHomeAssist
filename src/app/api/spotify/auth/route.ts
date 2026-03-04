import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/spotify/auth
 * Redirects the user to Spotify's authorization page.
 */
export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SPOTIFY_CLIENT_ID not configured" }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_ASSISTANT_API_URL?.replace(/\/+$/, "")}/api/spotify/callback/`;
  const scope = "user-read-playback-state user-modify-playback-state streaming";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    show_dialog: "true",
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
