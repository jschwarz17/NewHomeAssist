/**
 * Client-side Sonos control via direct HTTP requests to speakers on port 1400.
 * Works on Android via CapacitorHttp (bypasses CORS/mixed-content).
 * Speaker IPs are stored in localStorage.
 */

const SONOS_PORT = 1400;
const STORAGE_KEY = "sonos_speakers";

export interface SonosSpeaker {
  name: string;
  ip: string;
}

export function getSpeakers(): SonosSpeaker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSpeakers(speakers: SonosSpeaker[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(speakers));
}

export function findSpeaker(roomName?: string): SonosSpeaker | undefined {
  const speakers = getSpeakers();
  if (!speakers.length) return undefined;
  if (!roomName) return speakers[0];
  const lower = roomName.toLowerCase();
  return (
    speakers.find((s) => s.name.toLowerCase() === lower) ??
    speakers.find((s) => s.name.toLowerCase().includes(lower)) ??
    speakers[0]
  );
}

function soapEnvelope(serviceType: string, action: string, body: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
    `<s:Body><u:${action} xmlns:u="${serviceType}">${body}</u:${action}></s:Body>` +
    `</s:Envelope>`
  );
}

async function soapRequest(ip: string, path: string, serviceType: string, action: string, body: string): Promise<string> {
  const url = `http://${ip}:${SONOS_PORT}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${serviceType}#${action}"`,
    },
    body: soapEnvelope(serviceType, action, body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sonos ${action} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.text();
}

const AV_TRANSPORT = "urn:schemas-upnp-org:service:AVTransport:1";
const AV_TRANSPORT_PATH = "/MediaRenderer/AVTransport/Control";
const RENDERING_CONTROL = "urn:schemas-upnp-org:service:RenderingControl:1";
const RENDERING_CONTROL_PATH = "/MediaRenderer/RenderingControl/Control";

export async function play(roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured. Add a speaker IP in settings.");
  await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
  return `Playing on ${speaker.name}`;
}

export async function pause(roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured.");
  await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Pause", "<InstanceID>0</InstanceID>");
  return `Paused ${speaker.name}`;
}

export async function setVolume(volume: number, roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured.");
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  await soapRequest(
    speaker.ip,
    RENDERING_CONTROL_PATH,
    RENDERING_CONTROL,
    "SetVolume",
    `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${clamped}</DesiredVolume>`
  );
  return `Volume set to ${clamped} on ${speaker.name}`;
}

export async function setAVTransportURI(uri: string, roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured.");
  await soapRequest(
    speaker.ip,
    AV_TRANSPORT_PATH,
    AV_TRANSPORT,
    "SetAVTransportURI",
    `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(uri)}</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`
  );
  await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
  return `Playing on ${speaker.name}`;
}

/**
 * Discover all speakers on the network by querying one known speaker
 * for its ZoneGroupTopology.
 */
export async function discoverFromDevice(ip: string): Promise<SonosSpeaker[]> {
  const res = await fetch(`http://${ip}:${SONOS_PORT}/status/topology`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Could not reach speaker at ${ip}`);
  const xml = await res.text();

  const speakers: SonosSpeaker[] = [];
  const playerRegex = /<ZonePlayer\s[^>]*?location="http:\/\/([^:]+):\d+"[^>]*?name="([^"]*)"[^>]*?\/?>/gi;
  let match;
  while ((match = playerRegex.exec(xml)) !== null) {
    speakers.push({ ip: match[1], name: match[2] });
  }

  if (!speakers.length) {
    speakers.push({ ip, name: "Speaker" });
  }

  return speakers;
}

/**
 * Test if a speaker is reachable on port 1400.
 */
export async function testConnection(ip: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${ip}:${SONOS_PORT}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Play a Spotify URI on a Sonos speaker.
 * Converts spotify:track:xxx / spotify:playlist:xxx / spotify:album:xxx
 * into Sonos-compatible AVTransport URIs.
 */
export async function playSpotify(spotifyUri: string, title: string, roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured. Add a speaker IP in settings.");

  const sonosUri = spotifyUriToSonos(spotifyUri);
  const metadata = buildSpotifyMetadata(spotifyUri, title);

  await soapRequest(
    speaker.ip,
    AV_TRANSPORT_PATH,
    AV_TRANSPORT,
    "SetAVTransportURI",
    `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(sonosUri)}</CurrentURI><CurrentURIMetaData>${escapeXml(metadata)}</CurrentURIMetaData>`
  );
  await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
  return `Playing "${title}" on ${speaker.name}`;
}

function spotifyUriToSonos(uri: string): string {
  // spotify:track:6rqhFgbbKwnb9MLmUQDhG6 → x-sonos-spotify:spotify:track:6rqhFgbbKwnb9MLmUQDhG6
  // spotify:playlist:37i9dQZF1DX5IDTimEWoTd → x-rincon-cpcontainer:1006206cspotify:playlist:37i9dQZF1DX5IDTimEWoTd
  // spotify:album:xxx → x-rincon-cpcontainer:1004206cspotify:album:xxx
  const parts = uri.split(":");
  const type = parts[1];

  if (type === "track") {
    return `x-sonos-spotify:${uri}?sid=12&flags=8224&sn=5`;
  }
  if (type === "playlist") {
    return `x-rincon-cpcontainer:1006206c${uri}`;
  }
  if (type === "album") {
    return `x-rincon-cpcontainer:1004206c${uri}`;
  }
  return `x-sonos-spotify:${uri}?sid=12&flags=8224&sn=5`;
}

function buildSpotifyMetadata(uri: string, title: string): string {
  const parts = uri.split(":");
  const type = parts[1];
  const id = parts[2];

  let itemClass = "object.item.audioItem.musicTrack";
  let parentId = "";

  if (type === "track") {
    itemClass = "object.item.audioItem.musicTrack";
    parentId = `1004206c${uri}`;
  } else if (type === "playlist") {
    itemClass = "object.container.playlistContainer";
    parentId = `10062a6c${uri}`;
  } else if (type === "album") {
    itemClass = "object.container.album.musicAlbum";
    parentId = `1004206c${uri}`;
  }

  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return (
    `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">` +
    `<item id="00032020${uri}" parentID="${parentId}" restricted="true">` +
    `<dc:title>${safeTitle}</dc:title>` +
    `<upnp:class>${itemClass}</upnp:class>` +
    `<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON2311_X_#Svc2311-0-Token</desc>` +
    `</item></DIDL-Lite>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
