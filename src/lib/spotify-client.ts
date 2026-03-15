/**
 * Client-side Spotify integration.
 * Tokens stored in localStorage; refresh handled via server route.
 * Uses Spotify Connect to play on Sonos speakers directly.
 */

import { postDebugLog } from "@/lib/debug-log";

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

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const normalizedQuery = normalizeSearchText(query);
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
  const normalizedArtist = artist ? normalizeSearchText(artist.name) : "";
  const looksLikeArtistOnly = artist
    ? normalizedQuery === normalizedArtist ||
      normalizedArtist.startsWith(normalizedQuery) ||
      normalizedQuery.startsWith(normalizedArtist) ||
      normalizedArtist.includes(normalizedQuery)
    : false;
  if (artist && (lowerQuery.includes(artist.name.toLowerCase()) || isArtistRadio || looksLikeArtistOnly)) {
    if (isArtistRadio || looksLikeArtistOnly) {
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
    if (looksLikeArtistOnly) {
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
  // #region agent log
  postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H1',location:'src/lib/spotify-client.ts:199',message:'spotify playOnDevice prepared request',data:{roomName:roomName ?? null,uri,name:searchResult.name,type:searchResult.type,isContext,bodyMode:isContext ? 'context_uri' : 'uris'},timestamp:Date.now()}, apiBaseUrl);
  // #endregion

  // Poll for a Speaker-type device only (never phones/computers)
  let targetDevice: SpotifyDevice | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const devices = await getDevices(token);
    const speakers = devices.filter((d) => d.type === "Speaker");
    if (speakers.length) {
      if (roomName) {
        const lower = roomName.toLowerCase();
        const match = speakers.find((d) => d.name.toLowerCase().includes(lower));
        if (match) {
          targetDevice = match;
          break;
        }
      } else {
        targetDevice = speakers[0];
        break;
      }
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }

  if (roomName && !targetDevice) {
    throw new Error(`Speaker "${roomName}" not found in Spotify Connect. Falling back to direct control.`);
  }

  if (!targetDevice) {
    // #region agent log
    postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H6',location:'src/lib/spotify-client.ts:233',message:'spotify playOnDevice found no speaker device',data:{roomName:roomName ?? null,uri,name:searchResult.name},timestamp:Date.now()}, apiBaseUrl);
    // #endregion
    throw new Error("No Sonos speakers found in Spotify Connect. Falling back to direct control.");
  }

  // #region agent log
  postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H6',location:'src/lib/spotify-client.ts:237',message:'spotify playOnDevice selected target device',data:{roomName:roomName ?? null,targetDeviceId:targetDevice.id,targetDeviceName:targetDevice.name,targetDeviceType:targetDevice.type},timestamp:Date.now()}, apiBaseUrl);
  // #endregion

  const res = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${targetDevice.id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // #region agent log
  postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H6',location:'src/lib/spotify-client.ts:243',message:'spotify playOnDevice initial response',data:{roomName:roomName ?? null,status:res.status,ok:res.ok,targetDeviceName:targetDevice.name},timestamp:Date.now()}, apiBaseUrl);
  // #endregion

  if (res.status === 404 || res.status === 502) {
    await fetch(`${SPOTIFY_API}/me/player/pause?device_id=${targetDevice.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
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
    // #region agent log
    postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H6',location:'src/lib/spotify-client.ts:255',message:'spotify playOnDevice retry response',data:{roomName:roomName ?? null,status:retry.status,ok:retry.ok,targetDeviceName:targetDevice.name},timestamp:Date.now()}, apiBaseUrl);
    // #endregion
    if (!retry.ok && retry.status !== 204) {
      throw new Error(`Spotify play failed after transfer (${retry.status})`);
    }
  } else if (!res.ok && res.status !== 204) {
    throw new Error(`Spotify play failed (${res.status})`);
  }

  // #region agent log
  try {
    const playerRes = await fetch(`${SPOTIFY_API}/me/player`, { headers: { Authorization: `Bearer ${token}` } });
    const playerData = playerRes.ok ? await playerRes.json() : null;
    fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0ba768'},body:JSON.stringify({sessionId:'0ba768',runId:'song-debug',hypothesisId:'H2',location:'spotify-client.ts:playOnDevice-done',message:'Spotify player state after play',data:{roomName:roomName??null,targetDeviceName:targetDevice.name,targetDeviceId:targetDevice.id,isPlaying:playerData?.is_playing,deviceName:playerData?.device?.name,deviceId:playerData?.device?.id,deviceActive:playerData?.device?.is_active,trackName:playerData?.item?.name,trackUri:playerData?.item?.uri},timestamp:Date.now()})}).catch(()=>{});
  } catch(e) {}
  // #endregion
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
  // #region agent log
  postDebugLog({sessionId:'915513',runId:'voice-playback',hypothesisId:'H2',location:'src/lib/spotify-client.ts:277',message:'spotify queued recommendations after track start',data:{trackUri,deviceId:deviceId ?? null,recommendationCount:uris.length,firstRecommendation:uris[0] ?? null},timestamp:Date.now()}, apiBaseUrl);
  // #endregion

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

/**
 * Turn off repeat mode on the active Spotify playback so single tracks don't loop.
 */
export async function setRepeatOff(apiBaseUrl: string): Promise<void> {
  try {
    const token = await getAccessToken(apiBaseUrl);
    await fetch(`${SPOTIFY_API}/me/player/repeat?state=off`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Best-effort; don't block playback if this fails
  }
}
