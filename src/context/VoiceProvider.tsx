"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SpeakerId, VoiceContextValue } from "@/types/voice";

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}

interface VoiceProviderProps {
  children: React.ReactNode;
  /** Picovoice AccessKey (required for Porcupine in production) */
  picovoiceAccessKey?: string;
  /** Backend base URL for Ara/Grok + personalization (e.g. Vercel API) */
  apiBaseUrl?: string;
}

const PORCUPINE_MODEL = { publicPath: "/porcupine_params.pv" };
const WAKE_WORD_LABEL = "hey_ara";

function buildVoiceInstructions(speakerId: SpeakerId, memories: string[]): string {
  let base = "You are Ara, a warm and friendly home assistant for Casa de los Schwarzes. Use Park Slope, Brooklyn for weather and location. Keep responses brief and voice-friendly (1-3 sentences). Do NOT speak until the user speaks first — wait silently for the user's question before responding.";
  if (speakerId === "jesse") base += " User is Jesse (fintech, dev workflow; no dairy). Always start your reply with 'Hey Jesse'.";
  else if (speakerId === "vanessa") base += " User is Vanessa (calendar, music, lifestyle). Always start your reply with 'Hey Vanessa'.";
  else base += " Be friendly and concise.";

  base += " You have a store_memory tool — use it aggressively. ANY time a user shares personal information (names, preferences, facts about their life, pet names, family details, allergies, routines, languages, important dates) or says anything like 'remember', 'don't forget', 'I want you to know', 'I want to teach you', 'learn this', or corrects you about a fact — call store_memory immediately. When in doubt, store it. After storing, briefly confirm what you remembered.";
  base += " You have play_music, pause_music, and set_volume tools for Sonos speakers. Default music: 'Latin indie' playlist on living room speakers. The user can request any music and any room (living room, guest bathroom, bedroom, kitchen, office). Use pause_music to stop, set_volume to adjust loudness.";
  base += " You have a play_youtube tool to open YouTube videos. When the user wants to watch something, search YouTube and open it for them.";

  if (memories.length > 0) {
    base += "\n\nThings you remember from past conversations:\n" + memories.map((m) => `- ${m}`).join("\n");
  }
  return base;
}

export function VoiceProvider({
  children,
  picovoiceAccessKey,
  apiBaseUrl = "/api",
}: VoiceProviderProps) {
  const [isListening, setIsListening] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [speakerId, setSpeakerId] = useState<SpeakerId>(null);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wakeWordUnavailable, setWakeWordUnavailable] = useState(false);

  const porcupineRef = useRef<unknown>(null);
  const recognitionRef = useRef<{ abort?: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopVoiceSessionRef = useRef<(() => void) | null>(null);
  /** Sync guard so wake word firing twice doesn't start two Grok Voice sessions */
  const voiceSessionGuardRef = useRef(false);

  const startListening = useCallback(async () => {
    setError(null);
    setWakeWordDetected(false);
    setTranscript("");
    setLastResponse(null);
    setVoiceSessionActive(false);

    try {
      if (!picovoiceAccessKey) {
        setError("Picovoice access key not configured. Add NEXT_PUBLIC_PICOVOICE_API_KEY.");
        setIsListening(true);
        return;
      }

      const { Porcupine, BuiltInKeyword } = await import("@picovoice/porcupine-web");
      const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");

      const keywordDetectionCallback = () => {
        setWakeWordDetected(true);
        startGrokVoiceSession();
      };

      let porcupine;
      try {
        porcupine = await Porcupine.create(
          picovoiceAccessKey,
          [{ publicPath: "/hey_ara.ppn", label: WAKE_WORD_LABEL, sensitivity: 0.5 }],
          keywordDetectionCallback,
          PORCUPINE_MODEL,
          { processErrorCallback: (err) => setError(err?.message ?? "Porcupine error") }
        );
      } catch {
        try {
          porcupine = await Porcupine.create(
            picovoiceAccessKey,
            [{ publicPath: "/hi_ara.ppn", label: WAKE_WORD_LABEL, sensitivity: 0.5 }],
            keywordDetectionCallback,
            PORCUPINE_MODEL,
            { processErrorCallback: (err) => setError(err?.message ?? "Porcupine error") }
          );
        } catch {
          try {
            porcupine = await Porcupine.create(
              picovoiceAccessKey,
              [{ builtin: BuiltInKeyword.Porcupine, sensitivity: 0.5 }],
              keywordDetectionCallback,
              PORCUPINE_MODEL,
              { processErrorCallback: (err) => setError(err?.message ?? "Porcupine error") }
            );
          } catch {
            setWakeWordUnavailable(true);
            return;
          }
        }
      }

      porcupineRef.current = porcupine;
      await WebVoiceProcessor.subscribe(porcupine);
      setIsListening(true);

      const { startEagleRecognition } = await import("@/lib/eagle");
      const eagleResult = await startEagleRecognition(picovoiceAccessKey, (id) => setSpeakerId(id));
      if (!eagleResult.started && eagleResult.error && process.env.NODE_ENV === "development") {
        console.log("[VoiceProvider] Eagle not started (enroll jesse/vanessa on Android):", eagleResult.error);
      }
    } catch {
      setWakeWordUnavailable(true);
    }
  }, [picovoiceAccessKey]);

  async function startGrokVoiceSession() {
    if (voiceSessionGuardRef.current) return;
    voiceSessionGuardRef.current = true;
    setError(null);
    setVoiceSessionActive(true);
    setLastResponse(null);

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(`Microphone access denied: ${e instanceof Error ? e.message : String(e)}`);
      setVoiceSessionActive(false);
      voiceSessionGuardRef.current = false;
      return;
    }

    const [tokenResult, memories] = await Promise.all([
      getRealtimeToken(),
      fetchMemories(),
    ]);
    if (!tokenResult.token) {
      micStream.getTracks().forEach((t) => t.stop());
      setError(tokenResult.error || "Could not get voice token.");
      setVoiceSessionActive(false);
      voiceSessionGuardRef.current = false;
      return;
    }
    const token = tokenResult.token;
    const instructions = buildVoiceInstructions(speakerId, memories);
    const stop = await import("@/lib/grok-realtime-voice").then((m) =>
      m.startGrokRealtimeVoice({
        token,
        instructions,
        stream: micStream,
        apiBaseUrl,
        onError: (err) => {
          setError(err);
          setVoiceSessionActive(false);
          voiceSessionGuardRef.current = false;
        },
        onMemoryStored: (text) => {
          try {
            const raw = localStorage.getItem("ara_memories");
            const memories: string[] = raw ? JSON.parse(raw) : [];
            if (!memories.includes(text)) {
              memories.push(text);
              localStorage.setItem("ara_memories", JSON.stringify(memories));
            }
          } catch {}
        },
        onPlayMusic: async (query, device) => {
          try {
            const res = await fetch(`${apiBaseUrl}/sonos/play/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, device }),
            });
            const data = await res.json();
            return data.message ?? "Music request sent";
          } catch {
            return "Could not reach Sonos. Make sure the server is running locally.";
          }
        },
        onPauseMusic: async (device) => {
          try {
            const res = await fetch(`${apiBaseUrl}/sonos/pause/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ device }),
            });
            const data = await res.json();
            return data.message ?? "Paused";
          } catch {
            return "Could not reach Sonos";
          }
        },
        onSetVolume: async (volume, device) => {
          try {
            const res = await fetch(`${apiBaseUrl}/sonos/volume/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ volume, device }),
            });
            const data = await res.json();
            return data.message ?? `Volume set to ${volume}`;
          } catch {
            return "Could not reach Sonos";
          }
        },
        onPlayYouTube: async (query) => {
          try {
            const res = await fetch(`${apiBaseUrl}/youtube/search/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (data.videoUrl) {
              const { openLink } = await import("@/lib/open-link");
              await openLink(data.videoUrl);
              return `Opening YouTube: ${data.title ?? query}`;
            }
            return "Could not find a video";
          } catch {
            return "Could not reach YouTube";
          }
        },
      })
    );
    stopVoiceSessionRef.current = () => {
      stop();
      setVoiceSessionActive(false);
      voiceSessionGuardRef.current = false;
      setLastResponse(null);
    };
  }

  const stopListening = useCallback(async () => {
    voiceSessionGuardRef.current = false;
    if (stopVoiceSessionRef.current) {
      stopVoiceSessionRef.current();
      stopVoiceSessionRef.current = null;
    }
    try {
      const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");
      if (porcupineRef.current) {
        const p = porcupineRef.current as { release: () => Promise<void> };
        await WebVoiceProcessor.unsubscribe(p as Parameters<typeof WebVoiceProcessor.unsubscribe>[0]);
        await p.release();
        porcupineRef.current = null;
      }
    } catch {
      // ignore
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const { stopEagleRecognition } = await import("@/lib/eagle");
    await stopEagleRecognition();
    setWakeWordDetected(false);
    setVoiceSessionActive(false);
    setSpeakerId(null);
    setIsListening(false);
  }, []);

  const sendToAssistant = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);
      try {
        const url = `${apiBaseUrl}/process-request/`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            speakerId,
            transcript: text.trim(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `API error ${res.status}`);
        }
        const data = await res.json();
        if (data.response) setLastResponse(data.response);
        const commands = Array.isArray(data.taskerCommands)
          ? data.taskerCommands
          : data.taskerCommand
            ? [data.taskerCommand]
            : [];
        if (commands.length) {
          const { sendTaskerCommand } = await import("@/lib/tasker");
          for (const c of commands) {
            if (c?.task != null) await sendTaskerCommand(c.task, c.value ?? "");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Assistant request failed");
      }
    },
    [apiBaseUrl, speakerId]
  );

  const fetchMemories = useCallback(async (): Promise<string[]> => {
    try {
      const raw = localStorage.getItem("ara_memories");
      if (!raw) return [];
      const memories = JSON.parse(raw);
      return Array.isArray(memories) ? memories : [];
    } catch {
      return [];
    }
  }, []);

  const getRealtimeToken = useCallback(async (): Promise<{ token: string | null; error?: string }> => {
    try {
      const url = `${apiBaseUrl}/realtime-token/`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { token: null, error: `Token fetch failed (${res.status}): ${body || res.statusText}` };
      }
      const data = await res.json();
      const token = data?.client_secret?.value ?? data?.value ?? null;
      if (!token) return { token: null, error: "Token response missing client_secret" };
      return { token };
    } catch (e) {
      return { token: null, error: `Token fetch error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }, [apiBaseUrl]);

  const endVoiceSession = useCallback(() => {
    if (stopVoiceSessionRef.current) {
      stopVoiceSessionRef.current();
      stopVoiceSessionRef.current = null;
    }
    setVoiceSessionActive(false);
    setLastResponse(null);
  }, []);

  // Auto-start wake word listening when the app loads (no tap required)
  useEffect(() => {
    if (picovoiceAccessKey) startListening();
  }, [picovoiceAccessKey]); // eslint-disable-line react-hooks/exhaustive-deps -- start on key only

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const value: VoiceContextValue = {
    isListening,
    wakeWordDetected,
    voiceSessionActive,
    wakeWordUnavailable,
    speakerId,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    endVoiceSession,
    startVoiceSession: startGrokVoiceSession,
    sendToAssistant,
    getRealtimeToken,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

