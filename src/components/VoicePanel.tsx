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
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 space-y-3 h-full flex flex-col">
      <h3 className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Voice</h3>

      <p className="text-[11px] text-zinc-500 leading-snug">
        {wakeWordUnavailable
          ? "Tap below to talk to Ara."
          : "Say \"Hey Ara\" to start."}
      </p>

      {error && (
        <p className="text-red-400 text-xs leading-snug">{error}</p>
      )}

      <div className="flex flex-col gap-2 mt-auto">
        {!wakeWordUnavailable && !voiceSessionActive && (
          <button
            type="button"
            onClick={() => (isListening ? stopListening() : startListening())}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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
            className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            Talk to Ara
          </button>
        )}
        {voiceSessionActive && (
          <button
            type="button"
            onClick={endVoiceSession}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-amber-600/80 text-white hover:bg-amber-600"
          >
            End conversation
          </button>
        )}
        {speakerId && (
          <span className="text-zinc-400 text-xs capitalize text-center">{speakerId}</span>
        )}
        {wakeWordDetected && !voiceSessionActive && (
          <span className="text-emerald-400 text-xs text-center">Connecting…</span>
        )}
        {voiceSessionActive && (
          <span className="text-emerald-400 text-xs text-center animate-pulse">Speaking with Ara</span>
        )}
      </div>
    </div>
  );
}
