import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const spotifyCache = new Map<string, { spotifyId: string; spotifyTrackUri: string | null }>();

async function getClientToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify client credentials not configured");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!res.ok) {
    throw new Error(`Spotify token failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * GET /api/artists/spotify?name=ArtistName
 * Looks up artist on Spotify and returns artist ID + a representative track URI.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ spotifyId: null, spotifyTrackUri: null });
  }

  const cacheKey = name.toLowerCase();
  if (spotifyCache.has(cacheKey)) {
    const cached = spotifyCache.get(cacheKey)!;
    return NextResponse.json(cached);
  }

  try {
    const token = await getClientToken();

    // Search for artist
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) {
      return NextResponse.json({ spotifyId: null, spotifyTrackUri: null });
    }

    const searchData = await searchRes.json();
    const artist = searchData.artists?.items?.[0];
    if (!artist) {
      return NextResponse.json({ spotifyId: null, spotifyTrackUri: null });
    }

    const spotifyId = `spotify:artist:${artist.id}`;

    // Get artist's top tracks for a playable song
    const tracksRes = await fetch(
      `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let spotifyTrackUri: string | null = null;
    if (tracksRes.ok) {
      const tracksData = await tracksRes.json();
      const track = tracksData.tracks?.[0];
      spotifyTrackUri = track?.uri ?? null;
    }

    spotifyCache.set(cacheKey, { spotifyId, spotifyTrackUri });
    return NextResponse.json({ spotifyId, spotifyTrackUri });
  } catch (err) {
    console.error("[artists/spotify] error:", err);
    return NextResponse.json({ spotifyId: null, spotifyTrackUri: null });
  }
}
