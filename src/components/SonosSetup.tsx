"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSpeakers,
  saveSpeakers,
  discoverFromDevice,
  testConnection,
  clearSpotifyServiceCache,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-white">Sonos Speakers</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">
            Enter any one Sonos speaker IP to discover all speakers
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={seedIp}
              onChange={(e) => setSeedIp(e.target.value)}
              placeholder="192.168.1.50"
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovering}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-50 transition-colors shrink-0"
            >
              {discovering ? "..." : "Discover"}
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Find IPs in the Sonos app: Settings → System → About My System
          </p>
        </div>

        {status && (
          <p className={`text-xs mb-3 ${status.includes("Found") ? "text-green-400" : "text-amber-400"}`}>
            {status}
          </p>
        )}

        {speakers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wide">
              Configured speakers
            </h3>
            {speakers.map((s) => (
              <div
                key={s.ip}
                className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-sm text-white">{s.name}</span>
                  <span className="text-xs text-zinc-500 ml-2">{s.ip}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(s.ip)}
                  className="text-zinc-600 hover:text-red-400 text-xs"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}

        {speakers.length === 0 && !status && (
          <p className="text-xs text-zinc-500 text-center py-4">
            No speakers configured yet
          </p>
        )}

        {/* Spotify connection */}
        <div className="mt-5 pt-4 border-t border-zinc-700">
          <h3 className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-2">
            Spotify
          </h3>
          {spotifyConnected ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-400">Connected</span>
              <button
                type="button"
                onClick={() => { spotifyLogout(); setSpotifyConnected(false); }}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs text-zinc-500 mb-2">
                Connect Spotify so Ara can play any song, artist, or playlist by voice.
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_ASSISTANT_API_URL?.replace(/\/+$/, "") || ""}/api/spotify/auth/`}
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
              >
                Connect Spotify
              </a>
            </div>
          )}
        </div>

        {/* Test Playback */}
        {speakers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <button
              type="button"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                const log: string[] = [];
                const addLog = (msg: string) => { log.push(msg); setTestLog([...log]); };
                try {
                  const sp = speakers[0];
                  addLog(`Testing speaker: ${sp.name} (${sp.ip})`);
                  addLog(`Spotify logged in: ${isSpotifyLoggedIn()}`);

                  if (isSpotifyLoggedIn()) {
                    const spotify = await import("@/lib/spotify-client");
                    const apiBase = process.env.NEXT_PUBLIC_ASSISTANT_API_URL?.replace(/\/+$/, "") || "";
                    const apiUrl = apiBase ? `${apiBase}/api` : "/api";

                    addLog("Searching Spotify for 'latin indie'...");
                    try {
                      const result = await spotify.search("latin indie", apiUrl);
                      addLog(`Found: ${result.name} (${result.uri}) type=${result.type}`);

                      addLog("Checking Spotify Connect devices...");
                      const token = await (async () => {
                        const raw = localStorage.getItem("spotify_tokens");
                        if (!raw) throw new Error("no tokens");
                        const t = JSON.parse(raw);
                        if (Date.now() < t.expires_at - 60000) return t.access_token;
                        const res = await fetch(`${apiUrl}/spotify/refresh/`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ refresh_token: t.refresh_token }),
                        });
                        const nt = await res.json();
                        localStorage.setItem("spotify_tokens", JSON.stringify(nt));
                        return nt.access_token;
                      })();
                      const devRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const devData = await devRes.json();
                      const devices = devData.devices ?? [];
                      addLog(`Spotify devices: ${devices.length > 0 ? devices.map((d: {name: string; type: string; id: string}) => `${d.name} (${d.type}, ${d.id})`).join(", ") : "NONE"}`);

                      if (devices.length > 0) {
                        addLog("Trying Spotify Connect play...");
                        try {
                          const msg = await spotify.playOnDevice(result, sp.name, apiUrl);
                          addLog(`SUCCESS via Connect: ${msg}`);
                        } catch (e) {
                          addLog(`Connect failed: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      }
                    } catch (e) {
                      addLog(`Search/Connect error: ${e instanceof Error ? e.message : String(e)}`);
                    }

                    addLog("Trying Sonos UPnP playback...");
                    try {
                      const sonos = await import("@/lib/sonos-client");
                      const msg = await sonos.playSpotify("spotify:playlist:37i9dQZF1DX745Hk3hkznA", "latin indie", sp.name);
                      addLog(`SUCCESS via UPnP: ${msg}`);
                    } catch (e) {
                      addLog(`UPnP failed: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  } else {
                    addLog("Spotify not connected. Trying resume...");
                    const sonos = await import("@/lib/sonos-client");
                    try {
                      const msg = await sonos.play(sp.name);
                      addLog(`Resume: ${msg}`);
                    } catch (e) {
                      addLog(`Resume failed: ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }
                } catch (e) {
                  addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
                }
                setTesting(false);
              }}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {testing ? "Testing..." : "Test Playback"}
            </button>
            {testLog.length > 0 && (
              <div className="mt-2 bg-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                {testLog.map((line, i) => (
                  <p key={i} className={`text-xs font-mono ${line.includes("SUCCESS") ? "text-green-400" : line.includes("failed") || line.includes("Error") || line.includes("NONE") ? "text-red-400" : "text-zinc-300"}`}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
