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
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 h-full flex flex-col items-center justify-center text-center gap-3">
      {error && (
        <p className="text-red-400 text-[10px] leading-snug">{error}</p>
      )}

      {!wakeWordUnavailable && !voiceSessionActive && (
        <button
          type="button"
          onClick={() => (isListening ? stopListening() : startListening())}
          className={`w-full px-2 py-3 rounded-lg text-xs font-medium transition-colors ${
            isListening
              ? "bg-red-600/80 text-white hover:bg-red-600"
              : "bg-zinc-600 text-white hover:bg-zinc-500"
          }`}
        >
          {isListening ? "Stop" : "Listen"}
        </button>
      )}

      {wakeWordUnavailable && !voiceSessionActive && (
        <button
          type="button"
          onClick={startVoiceSession}
          className="w-full px-2 py-4 rounded-xl text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
        >
          Talk to Ara
        </button>
      )}

      {voiceSessionActive && (
        <>
          <span className="text-emerald-400 text-xs animate-pulse">Speaking with Ara</span>
          <button
            type="button"
            onClick={endVoiceSession}
            className="w-full px-2 py-3 rounded-lg text-xs font-medium bg-amber-600/80 text-white hover:bg-amber-600"
          >
            End
          </button>
        </>
      )}

      {speakerId && (
        <span className="text-zinc-400 text-[10px] capitalize">{speakerId}</span>
      )}
      {wakeWordDetected && !voiceSessionActive && (
        <span className="text-emerald-400 text-xs">Connecting…</span>
      )}
    </div>
  );
}
