"use client";

import { useState } from "react";
import { useVoice } from "@/context/VoiceProvider";
import { SonosSetup } from "@/components/SonosSetup";

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
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 h-[160px] min-h-0 flex flex-col items-center justify-center text-center gap-2 flex-shrink-0">
      {error && (
        <p className="text-red-400 text-[10px] leading-snug">{error}</p>
      )}

      {!voiceSessionActive && (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {showSettings && <SonosSetup onClose={() => setShowSettings(false)} />}

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
