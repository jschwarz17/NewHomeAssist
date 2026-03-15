const DEBUG_ENDPOINT = "http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33";
const DEBUG_SESSION_ID = "0ba768";

export interface DebugLogPayload {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export function postDebugLog(payload: DebugLogPayload, apiBaseUrl?: string): void {
  const body = JSON.stringify(payload);

  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_ID,
    },
    body,
  }).catch(() => {
    if (!apiBaseUrl) return;
    fetch(`${apiBaseUrl}/debug-log/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
  });
}
