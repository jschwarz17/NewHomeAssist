"use client";

import { useVoice } from "@/context/VoiceProvider";

export function VoicePanel() {
  const {
    isListening,
    wakeWordDetected,
    speakerId,
    transcript,
    lastResponse,
    error,
    startListening,
    stopListening,
    sendToAssistant,
  } = useVoice();

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 space-y-4">
      <h3 className="text-sm font-medium text-zinc-300">Voice</h3>
      <p className="text-xs text-zinc-500">
        Always listening for &quot;Hey Ara&quot;. Say it, then your command; use Send to assistant when ready. Tap Stop to pause wake word.
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
        {speakerId && (
          <span className="text-zinc-400 text-sm capitalize">{speakerId}</span>
        )}
        {wakeWordDetected && (
          <span className="text-emerald-400 text-sm">Wake word detected</span>
        )}
      </div>

      {transcript && (
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
