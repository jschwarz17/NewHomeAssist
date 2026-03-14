/**
 * Client-side Spotify integration.
 * Tokens stored in localStorage; refresh handled via server route.
 * Uses Spotify Connect to play on Sonos speakers directly.
 */

// #region agent log
const DBG_KEY = 'ara_debug_fe7a63';
function dbgLog(loc: string, msg: string, data: Record<string, unknown>) {
  try {
    const logs = JSON.parse(localStorage.getItem(DBG_KEY) || '[]');
    logs.push({ t: Date.now(), loc, msg, data });
    localStorage.setItem(DBG_KEY, JSON.stringify(logs));
  } catch {}
  try {
    fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fe7a63'},body:JSON.stringify({sessionId:'fe7a63',location:loc,message:msg,data,timestamp:Date.now()})}).catch(()=>{});
  } catch {}
}
export { DBG_KEY, dbgLog };
// #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'69e7cc'},body:JSON.stringify({sessionId:'69e7cc',location:'spotify-client.ts:search',message:'search returned track for artist query',data:{query,artistName:artist.name,type:'track',uri:artistTrack.uri},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
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
  // #region agent log
  dbgLog('addTrackRadioToQueue:entry', 'called', { trackUri, hasDeviceId: !!deviceId });
  // #endregion
  const token = await getAccessToken(apiBaseUrl);
  const trackId = trackUri.replace("spotify:track:", "");
  if (!trackId || trackId === trackUri) {
    // #region agent log
    dbgLog('addTrackRadioToQueue:badUri', 'not a track URI, aborting', { trackUri, trackId });
    // #endregion
    return;
  }

  const recRes = await fetch(
    `${SPOTIFY_API}/recommendations?seed_tracks=${encodeURIComponent(trackId)}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // #region agent log
  dbgLog('addTrackRadioToQueue:recResponse', 'recommendations API response', { status: recRes.status, ok: recRes.ok });
  // #endregion
  if (!recRes.ok) {
    // #region agent log
    let errBody = '';
    try { errBody = await recRes.clone().text(); } catch {}
    dbgLog('addTrackRadioToQueue:recFailed', 'recommendations API FAILED', { status: recRes.status, body: errBody.slice(0, 500) });
    // #endregion
    return;
  }
  const recData = (await recRes.json()) as { tracks?: Array<{ uri?: string }> };
  const uris = (recData.tracks ?? []).map((t) => t.uri).filter(Boolean) as string[];
  // #region agent log
  dbgLog('addTrackRadioToQueue:recParsed', 'recommendations parsed', { trackCount: recData.tracks?.length ?? 0, uriCount: uris.length, firstUri: uris[0] ?? null });
  // #endregion

  const deviceParam = deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : "";
  let firstStatus: number | undefined;
  let queuedOk = 0;
  for (const uri of uris.slice(0, 15)) {
    try {
      const qRes = await fetch(
        `${SPOTIFY_API}/me/player/queue?uri=${encodeURIComponent(uri)}${deviceParam}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (firstStatus === undefined) firstStatus = qRes.status;
      if (!qRes.ok) {
        // #region agent log
        let qBody = '';
        try { qBody = await qRes.clone().text(); } catch {}
        dbgLog('addTrackRadioToQueue:queueFailed', 'queue POST failed', { status: qRes.status, body: qBody.slice(0, 300), uri });
        // #endregion
        break;
      }
      queuedOk++;
    } catch (e) {
      // #region agent log
      dbgLog('addTrackRadioToQueue:queueError', 'queue POST threw', { error: e instanceof Error ? e.message : String(e) });
      // #endregion
      break;
    }
  }
  // #region agent log
  dbgLog('addTrackRadioToQueue:done', 'finished', { firstStatus, queuedOk, totalUris: uris.length });
  // #endregion
}

/**
 * Queue a track radio via Sonos UPnP when Spotify Connect is unavailable.
 * Clears the Sonos queue, adds the current track + recommendations, then
 * switches transport to the queue so playback continues automatically.
 */
export async function queueRadioViaSonos(
  trackUri: string,
  trackName: string,
  apiBaseUrl: string,
  roomName?: string
): Promise<void> {
  // #region agent log
  dbgLog('queueRadioViaSonos:entry', 'called', { trackUri, trackName, roomName });
  // #endregion

  const sonos = await import("@/lib/sonos-client");

  const token = await getAccessToken(apiBaseUrl);
  const trackId = trackUri.replace("spotify:track:", "");
  if (!trackId || trackId === trackUri) {
    // #region agent log
    dbgLog('queueRadioViaSonos:badUri', 'not a track URI', { trackUri });
    // #endregion
    return;
  }

  const recRes = await fetch(
    `${SPOTIFY_API}/recommendations?seed_tracks=${encodeURIComponent(trackId)}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // #region agent log
  dbgLog('queueRadioViaSonos:recResponse', 'recommendations API', { status: recRes.status, ok: recRes.ok });
  // #endregion
  if (!recRes.ok) {
    let errBody = '';
    try { errBody = await recRes.clone().text(); } catch {}
    // #region agent log
    dbgLog('queueRadioViaSonos:recFailed', 'recommendations FAILED', { status: recRes.status, body: errBody.slice(0, 500) });
    // #endregion
    return;
  }

  const recData = (await recRes.json()) as { tracks?: Array<{ uri?: string; name?: string }> };
  const recommended = (recData.tracks ?? []).filter((t): t is { uri: string; name: string } => !!t.uri && !!t.name);
  // #region agent log
  dbgLog('queueRadioViaSonos:recParsed', 'got recommendations', { count: recommended.length, first: recommended[0]?.name ?? null });
  // #endregion
  if (!recommended.length) return;

  try {
    await sonos.clearQueue(roomName);
  } catch {
    // #region agent log
    dbgLog('queueRadioViaSonos:clearFailed', 'clearQueue failed, continuing', {});
    // #endregion
  }

  let queued = 0;
  try {
    await sonos.addSpotifyTrackToQueue(trackUri, trackName, roomName);
    queued++;
  } catch (e) {
    // #region agent log
    dbgLog('queueRadioViaSonos:mainTrackFailed', 'failed to queue main track', { error: e instanceof Error ? e.message : String(e) });
    // #endregion
    return;
  }

  for (const track of recommended.slice(0, 15)) {
    try {
      await sonos.addSpotifyTrackToQueue(track.uri, track.name, roomName);
      queued++;
    } catch {
      break;
    }
  }

  try {
    await sonos.startQueuePlayback(roomName, 1);
  } catch (e) {
    // #region agent log
    dbgLog('queueRadioViaSonos:startFailed', 'startQueuePlayback failed', { error: e instanceof Error ? e.message : String(e) });
    // #endregion
  }

  // #region agent log
  dbgLog('queueRadioViaSonos:done', 'finished', { queued, totalRecommended: recommended.length });
  // #endregion
}
