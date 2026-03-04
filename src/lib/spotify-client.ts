/**
 * Client-side Spotify integration.
 * Tokens stored in localStorage; refresh handled via server route.
 */

const STORAGE_KEY = "spotify_tokens";
const SPOTIFY_API = "https://api.spotify.com/v1";

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export function isLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const tokens: SpotifyTokens = JSON.parse(raw);
    return !!tokens.refresh_token;
  } catch {
    return false;
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function getTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: SpotifyTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

async function getAccessToken(apiBaseUrl: string): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new Error("Not logged in to Spotify. Connect Spotify in settings.");

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  const res = await fetch(`${apiBaseUrl}/spotify/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  });

  if (!res.ok) {
    throw new Error("Spotify token refresh failed. Try reconnecting in settings.");
  }

  const newTokens: SpotifyTokens = await res.json();
  saveTokens(newTokens);
  return newTokens.access_token;
}

export interface SpotifySearchResult {
  uri: string;
  name: string;
  artist?: string;
  type: "track" | "album" | "playlist";
}

/**
 * Search Spotify and return the best matching item.
 * Tries playlists first for vague queries, tracks for specific ones.
 */
export async function search(query: string, apiBaseUrl: string): Promise<SpotifySearchResult> {
  const token = await getAccessToken(apiBaseUrl);

  const res = await fetch(
    `${SPOTIFY_API}/search?q=${encodeURIComponent(query)}&type=track,playlist,album&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Spotify search failed (${res.status})`);
  }

  const data = await res.json();

  const playlist = data.playlists?.items?.[0];
  const track = data.tracks?.items?.[0];
  const album = data.albums?.items?.[0];

  const lowerQuery = query.toLowerCase();
  const isVague = ["music", "something", "anything", "chill", "party", "workout", "indie", "jazz", "rock", "pop", "latin"].some(
    (w) => lowerQuery.includes(w)
  );

  if (isVague && playlist) {
    return {
      uri: playlist.uri,
      name: playlist.name,
      type: "playlist",
    };
  }

  if (track) {
    return {
      uri: track.uri,
      name: track.name,
      artist: track.artists?.[0]?.name,
      type: "track",
    };
  }

  if (playlist) {
    return {
      uri: playlist.uri,
      name: playlist.name,
      type: "playlist",
    };
  }

  if (album) {
    return {
      uri: album.uri,
      name: album.name,
      artist: album.artists?.[0]?.name,
      type: "album",
    };
  }

  throw new Error(`No results found for "${query}"`);
}
