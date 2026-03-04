"use client";

import { useVoice } from "@/context/VoiceProvider";

export function VoicePanel() {
  const {
    isListening,
    wakeWordDetected,
    voiceSessionActive,
    speakerId,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    endVoiceSession,
    sendToAssistant,
  } = useVoice();

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">Voice</h3>
      <p className="text-xs text-zinc-500">
        Say &quot;Hey Ara&quot; to start a voice conversation with Ara. You can talk back and forth; Ara responds with voice. Tap End to return to wake-word listening.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => (isListening ? stopListening() : startListening())}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isListening
              ? "bg-red-600/80 text-white hover:bg-red-600"
              : "bg-zinc-600 text-white hover:bg-zinc-500"
          }`}
        >
          {isListening ? "Stop listening" : "Start listening"}
        </button>
        {voiceSessionActive && (
          <button
            type="button"
            onClick={endVoiceSession}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600/80 text-white hover:bg-amber-600"
          >
            End conversation
          </button>
        )}
        {speakerId && (
          <span className="text-zinc-400 text-sm capitalize">{speakerId}</span>
        )}
        {wakeWordDetected && !voiceSessionActive && (
          <span className="text-emerald-400 text-sm">Hey Ara — connecting…</span>
        )}
        {voiceSessionActive && (
          <span className="text-emerald-400 text-sm">Speaking with Ara</span>
        )}
      </div>

      {transcript && !voiceSessionActive && (
        <div className="space-y-2">
          <p className="text-zinc-400 text-sm">Transcript: {transcript}</p>
          <button
            type="button"
            onClick={() => sendToAssistant(transcript)}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Send to assistant
          </button>
        </div>
      )}

      {lastResponse && (
        <p className="text-sm text-zinc-300">Ara: {lastResponse}</p>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
