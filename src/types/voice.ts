/**
 * Voice layer types: Porcupine (wake word), Eagle (speaker ID), STT.
 */

export type SpeakerId = "jesse" | "vanessa" | null;

export interface VoiceState {
  isListening: boolean;
  wakeWordDetected: boolean;
  /** True when in a live Grok Voice conversation (after wake word) */
  voiceSessionActive: boolean;
  /** True when Porcupine WASM can't run (e.g. Android WebView) */
  wakeWordUnavailable: boolean;
  speakerId: SpeakerId;
  transcript: string;
  /** Last response from Ara (transcript of voice or text) */
  lastResponse: string | null;
  error: string | null;
}

export interface VoiceContextValue extends VoiceState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  /** End the current Grok Voice session and return to wake-word listening */
  endVoiceSession: () => void;
  /** Manually start a Grok Voice session (bypasses wake word) */
  startVoiceSession: () => void;
  sendToAssistant: (text: string) => Promise<void>;
  getRealtimeToken: () => Promise<string | null>;
}
