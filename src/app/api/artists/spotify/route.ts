import { NextRequest, NextResponse } from "next/server";
import { CURATED_ARTISTS } from "@/lib/curated-artists";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const spotifyCache = new Map<string, { spotifyId: string; spotifyTrackUri: string | null }>();

interface SpotifyArtistSearchResult {
  id: string;
  name: string;
}

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

  const curatedArtist = CURATED_ARTISTS.find(
    (artist) => artist.name.toLowerCase() === name.toLowerCase()
  );
  if (curatedArtist?.spotifyId || curatedArtist?.spotifyTrackUri) {
    return NextResponse.json({
      spotifyId: curatedArtist.spotifyId,
      spotifyTrackUri: curatedArtist.spotifyTrackUri,
    });
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
    const artist = searchData.artists?.items?.[0] as SpotifyArtistSearchResult | undefined;
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

    if (!spotifyTrackUri) {
      const encodedArtist = encodeURIComponent(`artist:${artist.name}`);
      const trackSearchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodedArtist}&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (trackSearchRes.ok) {
        const trackSearchData = await trackSearchRes.json();
        const matchingTrack = trackSearchData.tracks?.items?.find(
          (track: {
            uri?: string;
            artists?: Array<{ id?: string }>;
          }) => track.artists?.some((trackArtist) => trackArtist.id === artist.id)
        );
        spotifyTrackUri = matchingTrack?.uri ?? null;
      }
    }

    spotifyCache.set(cacheKey, { spotifyId, spotifyTrackUri });
    return NextResponse.json({ spotifyId, spotifyTrackUri });
  } catch (err) {
    console.error("[artists/spotify] error:", err);
    return NextResponse.json({ spotifyId: null, spotifyTrackUri: null });
  }
}
