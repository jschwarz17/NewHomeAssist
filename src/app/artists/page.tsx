"use client";

import { useState, useCallback } from "react";
import { useArtists } from "@/context/ArtistsContext";
import { ArtistsSection } from "@/components/artists/ArtistsSection";
import type { ArtistSectionItem } from "@/context/ArtistsContext";

export default function ArtistsPage() {
  const { artists, loading, error, refresh } = useArtists();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 bg-black min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {error ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">{error}</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <button
                onClick={refresh}
                className="text-xs text-zinc-500 underline hover:text-zinc-400"
              >
                Retry
              </button>
              {process.env.NEXT_PUBLIC_REFRESH_KEY && (
                <a
                  href={`/api/cron/warm-artists?key=${encodeURIComponent(process.env.NEXT_PUBLIC_REFRESH_KEY)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 underline hover:text-zinc-400"
                >
                  Pre-load now (opens in new tab, takes 1–2 min)
                </a>
              )}
            </div>
          </div>
        ) : (
          <ArtistsSection
            title="Indie Rock Artists"
            items={artists}
            selectedId={selectedId}
            onSelect={handleSelect}
            loading={loading}
          />
        )}
      </div>
    </main>
  );
}
