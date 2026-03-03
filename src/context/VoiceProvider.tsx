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
  /** Picovoice AccessKey (required for Porcupine + Eagle in production) */
  picovoiceAccessKey?: string;
  /** Backend base URL for Ara/Grok + personalization (e.g. Vercel API) */
  apiBaseUrl?: string;
}

export function VoiceProvider({
  children,
  picovoiceAccessKey,
  apiBaseUrl = "/api",
}: VoiceProviderProps) {
  const [isListening, setIsListening] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [speakerId, setSpeakerId] = useState<SpeakerId>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const porcupineRef = useRef<unknown>(null);
  const eagleRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!picovoiceAccessKey) {
        setError("Picovoice access key not configured. Add NEXT_PUBLIC_PICOVOICE_ACCESS_KEY.");
        setIsListening(true);
        return;
      }

      // TODO: Initialize Porcupine for wake phrase "Hi Ara"
      // - Use @picovoice/web-porcupine or picovoice SDK; custom keyword "Hi Ara".
      // - On keyword detection → setWakeWordDetected(true) and start Eagle enrollment/identification.

      // TODO: Initialize Eagle for speaker identification (Jesse vs Vanessa)
      // - Use @picovoice/eagle-web or Eagle SDK; enroll/identify from same audio stream.
      // - On identification → setSpeakerId('jesse' | 'vanessa').

      // TODO: After wake word + speaker ID, capture next N seconds and send to STT (e.g. Web Speech API or cloud STT).
      // - Set result in setTranscript(...).

      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start microphone");
    }
  }, [picovoiceAccessKey]);

  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWakeWordDetected(false);
    setSpeakerId(null);
    setIsListening(false);
  }, []);

  const sendToAssistant = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);
      try {
        const url = `${apiBaseUrl}/assistant`;
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
        if (data.taskerCommand) {
          const { sendTaskerCommand } = await import("@/lib/tasker");
          await sendTaskerCommand(data.taskerCommand.task, data.taskerCommand.value);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Assistant request failed");
      }
    },
    [apiBaseUrl, speakerId]
  );

  const getRealtimeToken = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/realtime-token`, { method: "POST" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.client_secret?.value ?? data?.value ?? null;
    } catch {
      return null;
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const value: VoiceContextValue = {
    isListening,
    wakeWordDetected,
    speakerId,
    transcript,
    error,
    startListening,
    stopListening,
    sendToAssistant,
    getRealtimeToken,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}
