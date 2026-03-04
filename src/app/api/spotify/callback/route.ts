import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/spotify/callback
 * Spotify redirects here after user authorizes. Exchanges code for tokens,
 * then returns an HTML page that saves tokens to localStorage and closes.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return new NextResponse(
      `<html><body><h2>Spotify auth failed</h2><p>${error ?? "No code received"}</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/spotify/callback/`;

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new NextResponse(
      `<html><body><h2>Token exchange failed</h2><pre>${err}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const tokens = await tokenRes.json();

  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Spotify Connected</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <h2 style="color:#1DB954">Spotify Connected</h2>
  <p>You can close this tab.</p>
</div>
<script>
  try {
    const data = ${JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    })};
    localStorage.setItem("spotify_tokens", JSON.stringify(data));
  } catch(e) { console.error(e); }
</script>
</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
