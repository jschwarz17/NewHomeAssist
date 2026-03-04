"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSpeakers,
  saveSpeakers,
  discoverFromDevice,
  testConnection,
  type SonosSpeaker,
} from "@/lib/sonos-client";

export function SonosSetup({ onClose }: { onClose: () => void }) {
  const [speakers, setSpeakers] = useState<SonosSpeaker[]>([]);
  const [seedIp, setSeedIp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    setSpeakers(getSpeakers());
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
      </div>
    </div>
  );
}
