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
const WAKE_WORD_LABEL = "hi_ara";

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

  const porcupineRef = useRef<InstanceType<typeof import("@picovoice/porcupine-web").Porcupine> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    setError(null);
    setWakeWordDetected(false);
    setTranscript("");

    try {
      if (!picovoiceAccessKey) {
        setError("Picovoice access key not configured. Add NEXT_PUBLIC_PICOVOICE_ACCESS_KEY.");
        setIsListening(true);
        return;
      }

      const { Porcupine, BuiltInKeyword } = await import("@picovoice/porcupine-web");
      const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");

      const keywordDetectionCallback = (detection: { label: string }) => {
        setWakeWordDetected(true);
        startSpeechRecognition();
      };

      let porcupine;
      try {
        porcupine = await Porcupine.create(
          picovoiceAccessKey,
          [{ publicPath: "/hi_ara.ppn", label: WAKE_WORD_LABEL, sensitivity: 0.5 }],
          keywordDetectionCallback,
          PORCUPINE_MODEL,
          { processErrorCallback: (err) => setError(err?.message ?? "Porcupine error") }
        );
      } catch {
        porcupine = await Porcupine.create(
          picovoiceAccessKey,
          [{ builtin: BuiltInKeyword.Porcupine, sensitivity: 0.5 }],
          keywordDetectionCallback,
          PORCUPINE_MODEL,
          { processErrorCallback: (err) => setError(err?.message ?? "Porcupine error") }
        );
      }

      porcupineRef.current = porcupine;
      await WebVoiceProcessor.subscribe(porcupine);
      setIsListening(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start wake word";
      setError(msg);
      console.error("[VoiceProvider] startListening", e);
    }
  }, [picovoiceAccessKey]);

  function startSpeechRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const text = result[0]?.transcript?.trim();
      if (text) {
        setTranscript(text);
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  const stopListening = useCallback(async () => {
    try {
      const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");
      if (porcupineRef.current) {
        await WebVoiceProcessor.unsubscribe(porcupineRef.current);
        await porcupineRef.current.release();
        porcupineRef.current = null;
      }
    } catch {
      // ignore
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
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

