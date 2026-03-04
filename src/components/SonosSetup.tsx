"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSpeakers,
  saveSpeakers,
  discoverFromDevice,
  testConnection,
  clearSpotifyServiceCache,
  diagnoseSpeaker,
  type SonosSpeaker,
} from "@/lib/sonos-client";
import { isLoggedIn as isSpotifyLoggedIn, logout as spotifyLogout } from "@/lib/spotify-client";

export function SonosSetup({ onClose }: { onClose: () => void }) {
  const [speakers, setSpeakers] = useState<SonosSpeaker[]>([]);
  const [seedIp, setSeedIp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setSpeakers(getSpeakers());
    setSpotifyConnected(isSpotifyLoggedIn());
    clearSpotifyServiceCache();
  }, []);

  const handleDiscover = useCallback(async () => {
    const ip = seedIp.trim();
    if (!ip) {
      setStatus("Enter a speaker IP address");
      return;
    }
    setDiscovering(true);
    setStatus("Testing connection...");
    try {
      const ok = await testConnection(ip);
      if (!ok) {
        setStatus(`Could not reach ${ip}:1400. Make sure you're on the same WiFi.`);
        setDiscovering(false);
        return;
      }
      setStatus("Discovering speakers...");
      const found = await discoverFromDevice(ip);
      setSpeakers(found);
      saveSpeakers(found);
      setStatus(`Found ${found.length} speaker${found.length === 1 ? "" : "s"}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Discovery failed");
    }
    setDiscovering(false);
  }, [seedIp]);

  const handleRemove = useCallback((ip: string) => {
    setSpeakers((prev) => {
      const next = prev.filter((s) => s.ip !== ip);
      saveSpeakers(next);
      return next;
    });
  }, []);

  const runTest = useCallback(async () => {
    setTesting(true);
    const log: string[] = [];
    const addLog = (msg: string) => { log.push(msg); setTestLog([...log]); };
    try {
      const spkrs = getSpeakers();
      if (!spkrs.length) { addLog("No speakers configured"); setTesting(false); return; }
      const sp = spkrs[0];
      addLog(`Speaker: ${sp.name} (${sp.ip})`);
      addLog(`Spotify: ${isSpotifyLoggedIn() ? "yes" : "no"}`);

      addLog("Querying speaker services...");
      try {
        const diagLines = await diagnoseSpeaker(sp.ip);
        diagLines.forEach(l => addLog(l));
      } catch (e) {
        addLog(`diag err: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (isSpotifyLoggedIn()) {
        const spotify = await import("@/lib/spotify-client");
        const apiBase = process.env.NEXT_PUBLIC_ASSISTANT_API_URL?.replace(/\/+$/, "") || "";
        const apiUrl = apiBase ? `${apiBase}/api` : "/api";

        addLog("Searching 'latin indie'...");
        try {
          const result = await spotify.search("latin indie", apiUrl);
          addLog(`Found: ${result.name} (${result.uri})`);

          addLog("Waking speaker + Spotify Connect...");
          try {
            const msg = await spotify.playOnDevice(result, sp.name, apiUrl);
            addLog(`OK: ${msg}`);
            setTesting(false);
            return;
          } catch (e) {
            addLog(`Connect err: ${e instanceof Error ? e.message : String(e)}`);
          }
        } catch (e) {
          addLog(`Search err: ${e instanceof Error ? e.message : String(e)}`);
        }

        addLog("Trying Sonos UPnP...");
        try {
          const sonos = await import("@/lib/sonos-client");
          const msg = await sonos.playSpotify("spotify:playlist:37i9dQZF1DX745Hk3hkznA", "latin indie", sp.name);
          addLog(`OK UPnP: ${msg}`);
        } catch (e) {
          addLog(`UPnP err: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        addLog("No Spotify. Trying resume...");
        const sonos = await import("@/lib/sonos-client");
        try {
          const msg = await sonos.play(sp.name);
          addLog(`Resume: ${msg}`);
        } catch (e) {
          addLog(`Resume err: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTesting(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-2 pt-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-white">Settings</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Test Playback — first so it's always visible */}
        {speakers.length > 0 && (
          <div className="mb-4 pb-3 border-b border-zinc-700">
            <button
              type="button"
              disabled={testing}
              onClick={runTest}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Playback"}
            </button>
            {testLog.length > 0 && (
              <div className="mt-2 bg-zinc-800 rounded-lg p-2 max-h-56 overflow-y-auto">
                {testLog.map((line, i) => (
                  <p key={i} className={`text-[11px] font-mono leading-tight py-[1px] ${line.startsWith("OK") ? "text-green-400" : line.includes("err:") || line.includes("NONE") ? "text-red-400" : "text-zinc-300"}`}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spotify */}
        <div className="mb-4 pb-3 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Spotify</span>
            {spotifyConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400">Connected</span>
                <button type="button" onClick={() => { spotifyLogout(); setSpotifyConnected(false); }} className="text-xs text-zinc-500 hover:text-red-400">Disconnect</button>
              </div>
            ) : (
              <a
                href={`${process.env.NEXT_PUBLIC_ASSISTANT_API_URL?.replace(/\/+$/, "") || ""}/api/spotify/auth/`}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
              >
                Connect
              </a>
            )}
          </div>
        </div>

        {/* Speakers list */}
        {speakers.length > 0 && (
          <div className="mb-3">
            <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">Speakers ({speakers.length})</h3>
            <div className="space-y-1">
              {speakers.map((s) => (
                <div key={s.ip} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-1.5">
                  <div>
                    <span className="text-xs text-white">{s.name}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{s.ip}</span>
                  </div>
                  <button type="button" onClick={() => handleRemove(s.ip)} className="text-zinc-600 hover:text-red-400 text-[10px]">remove</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discover */}
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1">Add speaker by IP</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={seedIp}
              onChange={(e) => setSeedIp(e.target.value)}
              placeholder="192.168.1.50"
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovering}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors shrink-0"
            >
              {discovering ? "..." : "Discover"}
            </button>
          </div>
          {status && (
            <p className={`text-[10px] mt-1 ${status.includes("Found") ? "text-green-400" : "text-amber-400"}`}>{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
