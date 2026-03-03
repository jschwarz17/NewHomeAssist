/**
 * Voice layer types: Porcupine (wake word), Eagle (speaker ID), STT.
 */

export type SpeakerId = "jesse" | "vanessa" | null;

export interface VoiceState {
  isListening: boolean;
  wakeWordDetected: boolean;
  speakerId: SpeakerId;
  transcript: string;
  error: string | null;
}

export interface VoiceContextValue extends VoiceState {
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendToAssistant: (text: string) => Promise<void>;
}
