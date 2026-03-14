/**
 * Client-side Spotify integration.
 * Tokens stored in localStorage; refresh handled via server route.
 * Uses Spotify Connect to play on Sonos speakers directly.
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
  type: "track" | "album" | "playlist" | "artist";
}

/**
 * Search Spotify and return the best matching item.
 * Prioritizes playlists for vague/genre queries, tracks for specific artists/songs.
 */
export async function search(query: string, apiBaseUrl: string): Promise<SpotifySearchResult> {
  const token = await getAccessToken(apiBaseUrl);

  const res = await fetch(
    `${SPOTIFY_API}/search?q=${encodeURIComponent(query)}&type=track,playlist,album,artist&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Spotify search failed (${res.status})`);
  }

  const data = await res.json();

  const playlist = data.playlists?.items?.[0];
  const track = data.tracks?.items?.[0];
  const album = data.albums?.items?.[0];
  const artist = data.artists?.items?.[0];

  const lowerQuery = query.toLowerCase();
  const isGenreOrMood = ["music", "something", "anything", "chill", "party", "workout",
    "indie", "jazz", "rock", "pop", "latin", "classical", "hip hop", "r&b", "country",
    "electronic", "reggaeton", "salsa", "bachata", "ambient", "lofi", "lo-fi", "focus",
    "relax", "sleep", "happy", "sad", "energetic", "mellow"].some(
    (w) => lowerQuery.includes(w)
  );

  if (isGenreOrMood && playlist) {
    return { uri: playlist.uri, name: playlist.name, type: "playlist" };
  }

  const isArtistRadio = /\bradio\b/i.test(lowerQuery);
  if (artist && (lowerQuery.includes(artist.name.toLowerCase()) || isArtistRadio)) {
    if (isArtistRadio) {
      return { uri: artist.uri, name: artist.name, type: "artist" };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artistTrack = data.tracks?.items?.find((t: any) =>
      t.artists?.some((a: any) => a.id === artist.id)
    );
    if (artistTrack) {
      return { uri: artistTrack.uri, name: artistTrack.name, artist: artist.name, type: "track" };
    }
    return { uri: artist.uri, name: artist.name, type: "artist" };
  }

  if (track) {
    return { uri: track.uri, name: track.name, artist: track.artists?.[0]?.name, type: "track" };
  }

  if (artist) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artistTrack = data.tracks?.items?.find((t: any) =>
      t.artists?.some((a: any) => a.id === artist.id)
    );
    if (artistTrack) {
      return { uri: artistTrack.uri, name: artistTrack.name, artist: artist.name, type: "track" };
    }
    return { uri: artist.uri, name: artist.name, type: "artist" };
  }

  if (playlist) {
    return { uri: playlist.uri, name: playlist.name, type: "playlist" };
  }

  if (album) {
    return { uri: album.uri, name: album.name, artist: album.artists?.[0]?.name, type: "album" };
  }

  throw new Error(`No Spotify results for "${query}"`);
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

/**
 * Get available Spotify Connect devices (includes Sonos speakers).
 */
async function getDevices(token: string): Promise<SpotifyDevice[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.devices ?? [];
}

/**
 * Find a Sonos speaker in Spotify Connect devices by room name.
 */
function findDevice(devices: SpotifyDevice[], roomName?: string): SpotifyDevice | undefined {
  if (!roomName) {
    return devices.find((d) => d.type === "Speaker") ?? devices[0];
  }
  const lower = roomName.toLowerCase();
  return (
    devices.find((d) => d.name.toLowerCase() === lower) ??
    devices.find((d) => d.name.toLowerCase().includes(lower)) ??
    devices.find((d) => d.type === "Speaker") ??
    devices[0]
  );
}

/**
 * Play a Spotify URI on a Sonos speaker via Spotify Connect.
 * Only targets Speaker-type devices — never phones/computers.
 * Wakes the speaker via Sonos SOAP first so it appears in the device list.
 */
export async function playOnDevice(
  searchResult: SpotifySearchResult,
  roomName: string | undefined,
  apiBaseUrl: string
): Promise<string> {
  const token = await getAccessToken(apiBaseUrl);

  const uri = searchResult.uri;
  const isContext = uri.startsWith("spotify:playlist:") || uri.startsWith("spotify:album:") || uri.startsWith("spotify:artist:");
  const body: Record<string, unknown> = isContext ? { context_uri: uri } : { uris: [uri] };

  // Wake the target Sonos speaker so it registers with Spotify Connect
  try {
    const sonos = await import("@/lib/sonos-client");
    const speaker = sonos.findSpeaker(roomName);
    if (speaker) {
      await sonos.play(speaker.name);
      await new Promise((r) => setTimeout(r, 3000));
    }
  } catch { /* speaker wake failed, continue anyway */ }

  // Poll for a Speaker-type device only (never phones/computers)
  let targetDevice: SpotifyDevice | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const devices = await getDevices(token);
    const speakers = devices.filter((d) => d.type === "Speaker");
    if (speakers.length) {
      const lower = (roomName ?? "").toLowerCase();
      targetDevice = speakers.find((d) => d.name.toLowerCase().includes(lower))
        ?? speakers[0];
      break;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }

  if (!targetDevice) {
    throw new Error("No Sonos speakers found in Spotify Connect. Falling back to direct control.");
  }

  const res = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${targetDevice.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 404 || res.status === 502) {
    await fetch(`${SPOTIFY_API}/me/player`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [targetDevice.id], play: false }),
    });
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${targetDevice.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!retry.ok && retry.status !== 204) {
      throw new Error(`Spotify play failed after transfer (${retry.status})`);
    }
  } else if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify play failed (${res.status})`);
  }

  return `Playing "${searchResult.name}" on ${targetDevice.name}`;
}

/**
 * Fetch track recommendations (song radio) and add them to the current playback queue.
 * Call after starting a single track so playback continues with similar songs.
 */
export async function addTrackRadioToQueue(
  trackUri: string,
  apiBaseUrl: string,
  deviceId?: string
): Promise<void> {
  const token = await getAccessToken(apiBaseUrl);
  const trackId = trackUri.replace("spotify:track:", "");
  if (!trackId || trackId === trackUri) return;

  const recRes = await fetch(
    `${SPOTIFY_API}/recommendations?seed_tracks=${encodeURIComponent(trackId)}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!recRes.ok) return;
  const recData = (await recRes.json()) as { tracks?: Array<{ uri?: string }> };
  const uris = (recData.tracks ?? []).map((t) => t.uri).filter(Boolean) as string[];

  const deviceParam = deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : "";
  for (const uri of uris.slice(0, 15)) {
    try {
      const qRes = await fetch(
        `${SPOTIFY_API}/me/player/queue?uri=${encodeURIComponent(uri)}${deviceParam}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!qRes.ok) break;
    } catch {
      break;
    }
  }
}
