/**
 * Voice layer types: Porcupine (wake word), Eagle (speaker ID), STT.
 */

export type SpeakerId = "jesse" | "vanessa" | null;

export interface VoiceState {
  isListening: boolean;
  wakeWordDetected: boolean;
  speakerId: SpeakerId;
  transcript: string;
  /** Last response from Ara (so UI can show "Hey Jesse, ...") */
  lastResponse: string | null;
  error: string | null;
}

export interface VoiceContextValue extends VoiceState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendToAssistant: (text: string) => Promise<void>;
  /** Fetch ephemeral token for Grok Voice Agent (wss://api.x.ai/v1/realtime) with voice "Ara" */
  getRealtimeToken: () => Promise<string | null>;
}
