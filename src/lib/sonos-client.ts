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
 * for its ZoneGroupTopology via SOAP (most reliable method).
 */
export async function discoverFromDevice(ip: string): Promise<SonosSpeaker[]> {
  const speakers: SonosSpeaker[] = [];

  try {
    const soapBody =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
      `<s:Body><u:GetZoneGroupState xmlns:u="urn:schemas-upnp-org:service:ZoneGroupTopology:1"></u:GetZoneGroupState></s:Body>` +
      `</s:Envelope>`;

    const res = await fetch(`http://${ip}:${SONOS_PORT}/ZoneGroupTopology/Control`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"urn:schemas-upnp-org:service:ZoneGroupTopology:1#GetZoneGroupState"',
      },
      body: soapBody,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error("SOAP failed");
    let xml = await res.text();

    xml = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    const memberRegex = /<ZoneGroupMember\s[^>]*?>/gi;
    let match;
    while ((match = memberRegex.exec(xml)) !== null) {
      const tag = match[0];
      const locMatch = tag.match(/Location="http:\/\/([^:]+):\d+/i);
      const nameMatch = tag.match(/ZoneName="([^"]*)"/i);
      if (locMatch && nameMatch) {
        const memberIp = locMatch[1];
        const name = nameMatch[1];
        if (!speakers.some((s) => s.ip === memberIp)) {
          speakers.push({ ip: memberIp, name });
        }
      }
    }
  } catch {
    // Fallback: try /status/topology
    try {
      const res = await fetch(`http://${ip}:${SONOS_PORT}/status/topology`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const xml = await res.text();
        const playerRegex = /<ZonePlayer[^>]+>/gi;
        let match;
        while ((match = playerRegex.exec(xml)) !== null) {
          const tag = match[0];
          const locMatch = tag.match(/location="http:\/\/([^:]+):\d+/i);
          const nameMatch = tag.match(/name="([^"]*)"/i);
          if (locMatch && nameMatch) {
            const memberIp = locMatch[1];
            const name = nameMatch[1];
            if (!speakers.some((s) => s.ip === memberIp)) {
              speakers.push({ ip: memberIp, name });
            }
          }
        }
      }
    } catch {
      // both methods failed
    }
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

interface SpotifyServiceInfo {
  sid: string;
  sn: string;
  accountToken: string;
}

const SPOTIFY_SVC_CACHE_KEY = "sonos_spotify_svc";

export function clearSpotifyServiceCache(): void {
  try { localStorage.removeItem(SPOTIFY_SVC_CACHE_KEY); } catch { /* ignore */ }
}

export async function diagnoseSpeaker(ip: string): Promise<string[]> {
  const lines: string[] = [];

  try {
    const svcXml = await soapRequest(
      ip,
      "/MusicServices/Control",
      "urn:schemas-upnp-org:service:MusicServices:1",
      "ListAvailableServices",
      ""
    );
    const decoded = svcXml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

    const serviceMatches = decoded.matchAll(/Id="(\d+)"[^>]*Name="([^"]+)"/gi);
    for (const m of serviceMatches) {
      const tag = m[2] === "Spotify" ? " <<<" : "";
      lines.push(`svc: id=${m[1]} name=${m[2]}${tag}`);
    }
    if (!lines.length) {
      const altMatches = decoded.matchAll(/<Service[^>]*>/gi);
      for (const m of altMatches) {
        lines.push(`raw svc: ${m[0].slice(0, 120)}`);
      }
    }
    if (!lines.length) lines.push(`svcXml (200ch): ${decoded.slice(0, 200)}`);
  } catch (e) {
    lines.push(`ListSvc err: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const acctXml = await soapRequest(
      ip,
      "/SystemProperties/Control",
      "urn:schemas-upnp-org:service:SystemProperties:1",
      "GetString",
      "<VariableName>R_AvailableServiceList</VariableName>"
    );
    const decoded = acctXml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    const acctMatches = decoded.matchAll(/ServiceId="(\d+)"[^>]*SerialNum="(\d+)"/gi);
    for (const m of acctMatches) {
      lines.push(`acct: sid=${m[1]} sn=${m[2]}`);
    }
    if (!lines.some(l => l.startsWith("acct:"))) {
      lines.push(`acctXml (200ch): ${decoded.slice(0, 200)}`);
    }
  } catch (e) {
    lines.push(`GetString err: ${e instanceof Error ? e.message : String(e)}`);
  }

  const info = await getSpotifyServiceInfo(ip);
  lines.push(`using: sid=${info.sid} sn=${info.sn} token=${info.accountToken}`);

  return lines;
}

async function getSpotifyServiceInfo(ip: string): Promise<SpotifyServiceInfo> {
  try {
    const cached = localStorage.getItem(SPOTIFY_SVC_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }

  const defaults: SpotifyServiceInfo = { sid: "9", sn: "1", accountToken: "SA_RINCON2311_X_#Svc2311-0-Token" };

  try {
    const svcXml = await soapRequest(
      ip,
      "/MusicServices/Control",
      "urn:schemas-upnp-org:service:MusicServices:1",
      "ListAvailableServices",
      ""
    );

    const decoded = svcXml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    const sidMatch = decoded.match(/Id>(\d+)<[^]*?Name>Spotify/i)
      ?? decoded.match(/Id="(\d+)"[^>]*Name="Spotify"/i);
    if (sidMatch) defaults.sid = sidMatch[1];
  } catch { /* use defaults */ }

  try {
    const acctXml = await soapRequest(
      ip,
      "/SystemProperties/Control",
      "urn:schemas-upnp-org:service:SystemProperties:1",
      "GetString",
      "<VariableName>R_AvailableServiceList</VariableName>"
    );
    const decoded = acctXml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    const snMatch = decoded.match(new RegExp(`ServiceId="${defaults.sid}"[^>]*SerialNum="(\\d+)"`, "i"))
      ?? decoded.match(new RegExp(`SerialNum="(\\d+)"[^>]*ServiceId="${defaults.sid}"`, "i"));
    if (snMatch) defaults.sn = snMatch[1];
  } catch { /* use defaults */ }

  try { localStorage.setItem(SPOTIFY_SVC_CACHE_KEY, JSON.stringify(defaults)); } catch { /* ignore */ }
  return defaults;
}

/**
 * Play a Spotify URI on a Sonos speaker.
 * Tries multiple URI formats for compatibility across Sonos firmware versions.
 */
export async function playSpotify(spotifyUri: string, title: string, roomName?: string): Promise<string> {
  const speaker = findSpeaker(roomName);
  if (!speaker) throw new Error("No Sonos speakers configured. Add a speaker IP in settings.");

  // For artist URIs, convert to artist radio which Sonos handles better
  let uri = spotifyUri;
  if (uri.startsWith("spotify:artist:")) {
    uri = uri.replace("spotify:artist:", "spotify:artistRadio:");
  }

  const svc = await getSpotifyServiceInfo(speaker.ip);
  const errors: string[] = [];

  // Attempt 1: SetAVTransportURI with URL-encoded Spotify URI
  try {
    const encodedUri = uri.replace(/:/g, "%3a");
    const sonosUri = `x-sonos-spotify:${encodedUri}?sid=${svc.sid}&flags=8224&sn=${svc.sn}`;
    const metadata = buildSpotifyMetadata(uri, title, svc);
    await soapRequest(
      speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "SetAVTransportURI",
      `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(sonosUri)}</CurrentURI><CurrentURIMetaData>${escapeXml(metadata)}</CurrentURIMetaData>`
    );
    await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
    return `Playing "${title}" on ${speaker.name}`;
  } catch (e) {
    errors.push(`attempt1: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Attempt 2: SetAVTransportURI with non-encoded URI
  try {
    const sonosUri = `x-sonos-spotify:${uri}?sid=${svc.sid}&flags=8224&sn=${svc.sn}`;
    const metadata = buildSpotifyMetadata(uri, title, svc);
    await soapRequest(
      speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "SetAVTransportURI",
      `<InstanceID>0</InstanceID><CurrentURI>${escapeXml(sonosUri)}</CurrentURI><CurrentURIMetaData>${escapeXml(metadata)}</CurrentURIMetaData>`
    );
    await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
    return `Playing "${title}" on ${speaker.name}`;
  } catch (e) {
    errors.push(`attempt2: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Attempt 3: AddURIToQueue then play
  try {
    const encodedUri = uri.replace(/:/g, "%3a");
    const sonosUri = `x-sonos-spotify:${encodedUri}?sid=${svc.sid}&flags=8224&sn=${svc.sn}`;
    const metadata = buildSpotifyMetadata(uri, title, svc);

    await soapRequest(
      speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "RemoveAllTracksFromQueue",
      "<InstanceID>0</InstanceID>"
    );
    await soapRequest(
      speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "AddURIToQueue",
      `<InstanceID>0</InstanceID><EnqueuedURI>${escapeXml(sonosUri)}</EnqueuedURI><EnqueuedURIMetaData>${escapeXml(metadata)}</EnqueuedURIMetaData><DesiredFirstTrackNumberEnqueued>0</DesiredFirstTrackNumberEnqueued><EnqueueAsNext>1</EnqueueAsNext>`
    );
    await soapRequest(
      speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "SetAVTransportURI",
      `<InstanceID>0</InstanceID><CurrentURI>x-rincon-queue:${escapeXml(speaker.ip)}#0</CurrentURI><CurrentURIMetaData></CurrentURIMetaData>`
    );
    await soapRequest(speaker.ip, AV_TRANSPORT_PATH, AV_TRANSPORT, "Play", "<InstanceID>0</InstanceID><Speed>1</Speed>");
    return `Playing "${title}" on ${speaker.name}`;
  } catch (e) {
    errors.push(`attempt3: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(`All playback attempts failed. ${errors.join(" | ")}`);
}

function buildSpotifyMetadata(uri: string, title: string, svc: SpotifyServiceInfo): string {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return (
    `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">` +
    `<item id="00032020${uri}" parentID="0" restricted="true">` +
    `<dc:title>${safeTitle}</dc:title>` +
    `<upnp:class>object.item.audioItem.musicTrack</upnp:class>` +
    `<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${svc.accountToken}</desc>` +
    `</item></DIDL-Lite>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
