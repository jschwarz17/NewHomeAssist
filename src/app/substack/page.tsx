"use client";

import { useState } from "react";
import { useSubstack } from "@/context/SubstackContext";
import { ArticlesSection } from "@/components/substack/ArticlesSection";

export default function SubstackPage() {
  const { ai, politics, fintech, loading, error, refresh } = useSubstack();
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const handlePlay = (url: string) => {
    setPlayingUrl(url);
    // Stop any currently playing speech
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
  };

  return (
    <main className="flex-1 bg-black min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">{error}</p>
            <div className="mt-3">
              <button
                onClick={refresh}
                className="text-xs text-zinc-500 underline hover:text-zinc-400"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <ArticlesSection
              title="AI Articles"
              articles={ai}
              playingUrl={playingUrl}
              onPlay={handlePlay}
              loading={loading}
            />
            <ArticlesSection
              title="Politics Articles"
              articles={politics}
              playingUrl={playingUrl}
              onPlay={handlePlay}
              loading={loading}
            />
            <ArticlesSection
              title="Fintech Articles"
              articles={fintech}
              playingUrl={playingUrl}
              onPlay={handlePlay}
              loading={loading}
            />
          </>
        )}
      </div>
    </main>
  );
}
