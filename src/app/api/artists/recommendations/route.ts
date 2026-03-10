import { NextResponse } from "next/server";
import { getArtistsCache } from "@/lib/artists-cache";
import type { ArtistItem } from "@/lib/artists-recommendations-grok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Re-export for consumers that import from the route
export type { ArtistItem } from "@/lib/artists-recommendations-grok";

export async function GET() {
  // 1. Prefer persistent cache (filled by cron or a previous request)
  const cached = await getArtistsCache();
  if (cached && cached.artists.length > 0) {
    return NextResponse.json(
      {
        artists: cached.artists as ArtistItem[],
        cachedAt: cached.cachedAt,
        version: cached.version,
      },
      { headers: CORS_HEADERS }
    );
  }

  // 2. No cache: return mock data in dev for testing, else 503
  if (process.env.NODE_ENV === "development") {
    const mockArtists: ArtistItem[] = [
      {
        name: "Radiohead",
        description: "Pioneering alternative rock band known for experimental soundscapes.",
        genre: "Alternative Rock",
        spotifyId: "spotify:artist:4Z8W4fKeB5YxbusRsdQVPb",
        spotifyTrackUri: "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
        imageUrl: "https://i.scdn.co/image/ab6761610000e5eb9896acf020f0a3f0e0f8783f",
      },
      {
        name: "Foals",
        description: "British indie rock band with math-rock roots and atmospheric builds.",
        genre: "Indie Rock",
        spotifyId: "spotify:artist:6FQqZYVfTNQ1pCqfkwVFEa",
        spotifyTrackUri: "spotify:track:2takcwOaAZWiXQijPHIx7B",
        imageUrl: null,
      },
      {
        name: "Black Country, New Road",
        description: "Experimental post-punk band with orchestral arrangements.",
        genre: "Post-Punk",
        spotifyId: "spotify:artist:6CHsZ9fi0NJLQxjrV71L56",
        spotifyTrackUri: "spotify:track:4i0hcvQz9QOVnkvWsGItQw",
        imageUrl: null,
      },
    ];
    return NextResponse.json(
      { artists: mockArtists, cachedAt: Date.now(), version: 0 },
      { headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      error:
        "Artists refresh daily. Try again in a few minutes or tap Retry.",
    },
    { status: 503, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}
