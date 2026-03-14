"use client";
// #region agent log
import { useState } from "react";

const DBG_KEY = "ara_debug_fe7a63";

export function DebugLogOverlay() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string>("");

  const loadLogs = () => {
    try {
      const raw = localStorage.getItem(DBG_KEY);
      if (!raw) { setLogs("No debug logs yet."); return; }
      const parsed = JSON.parse(raw);
      setLogs(parsed.map((l: { t: number; loc: string; msg: string; data: unknown }) =>
        `[${new Date(l.t).toLocaleTimeString()}] ${l.loc}: ${l.msg}\n${JSON.stringify(l.data, null, 1)}`
      ).join("\n---\n"));
    } catch (e) {
      setLogs(`Error: ${e}`);
    }
  };

  const clearLogs = () => {
    localStorage.removeItem(DBG_KEY);
    setLogs("Cleared.");
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); loadLogs(); }}
        style={{ position: "fixed", bottom: 4, left: 4, zIndex: 99999, background: "#333", color: "#0f0", border: "1px solid #555", borderRadius: 4, padding: "2px 6px", fontSize: 10, opacity: 0.6 }}
      >
        DBG
      </button>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.95)", color: "#0f0", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        <button onClick={loadLogs} style={{ background: "#222", color: "#0f0", border: "1px solid #555", borderRadius: 4, padding: "4px 10px", fontSize: 11 }}>Refresh</button>
        <button onClick={clearLogs} style={{ background: "#222", color: "#f80", border: "1px solid #555", borderRadius: 4, padding: "4px 10px", fontSize: 11 }}>Clear</button>
        <button onClick={() => setOpen(false)} style={{ background: "#222", color: "#f00", border: "1px solid #555", borderRadius: 4, padding: "4px 10px", fontSize: 11, marginLeft: "auto" }}>Close</button>
      </div>
      <pre style={{ flex: 1, overflow: "auto", padding: 8, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{logs}</pre>
    </div>
  );
}
// #endregion
