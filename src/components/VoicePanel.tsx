"use client";

import { useVoice } from "@/context/VoiceProvider";

export function VoicePanel() {
  const {
    isListening,
    wakeWordDetected,
    voiceSessionActive,
    wakeWordUnavailable,
    speakerId,
    error,
    startListening,
    stopListening,
    endVoiceSession,
    startVoiceSession,
  } = useVoice();

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">Voice</h3>
      <p className="text-xs text-zinc-500">
        {wakeWordUnavailable
          ? "Tap below to talk to Ara."
          : "Say \"Hey Ara\" to start a voice conversation with Ara. Tap End to return to wake-word listening."}
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        {!wakeWordUnavailable && !voiceSessionActive && (
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
        )}
        {wakeWordUnavailable && !voiceSessionActive && (
          <button
            type="button"
            onClick={startVoiceSession}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            Talk to Ara
          </button>
        )}
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

      {error && !wakeWordUnavailable && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
