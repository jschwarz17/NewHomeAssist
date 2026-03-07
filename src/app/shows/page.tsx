"use client";

import { useState, useCallback } from "react";
import { useYouTube } from "@/context/YouTubeContext";
import { useShows, type ShowMood } from "@/context/ShowsContext";
import { ShowsSection } from "@/components/shows/ShowsSection";
import type { ShowsSectionItem } from "@/context/ShowsContext";

type Filter = "all" | ShowMood | "intl";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fun", label: "Fun" },
  { id: "gritty", label: "Gritty" },
  { id: "quirky", label: "Quirky" },
  { id: "funny", label: "Funny" },
  { id: "suspenseful", label: "Suspenseful" },
  { id: "intl", label: "Int'l" },
];

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export default function ShowsPage() {
  const { playVideo } = useYouTube();
  const { shows, movies, loading, error, refresh } = useShows();

  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingTrailerId, setLoadingTrailerId] = useState<string | null>(null);

  // ── Filter items by mood ──────────────────────────────────────────────────
  function applyFilter(items: ShowsSectionItem[]) {
    if (activeFilter === "all") return items;
    if (activeFilter === "intl")
      return items.filter(
        (item) => item.language && item.language.toLowerCase() !== "english"
      );
    return items.filter((item) => item.mood === activeFilter);
  }

  // ── Play trailer ──────────────────────────────────────────────────────────
  const handlePlayTrailer = useCallback(
    async (item: ShowsSectionItem) => {
      if (loadingTrailerId) return;
      setLoadingTrailerId(item.id);

      try {
        const base = getApiBase();
        const url = base
          ? `${base}/api/youtube/search/`
          : "/api/youtube/search";

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: item.trailerSearchQuery }),
        });
        const data = await res.json();

        if (data.success && data.videoId) {
          playVideo(data.videoId, `${item.title} — Trailer`);
        } else {
          console.warn("[shows] trailer not found:", data.message);
        }
      } catch (e) {
        console.error("[shows] trailer fetch error:", e);
      } finally {
        setLoadingTrailerId(null);
      }
    },
    [loadingTrailerId, playVideo]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const filteredShows = applyFilter(shows);
  const filteredMovies = applyFilter(movies);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 bg-black min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Filter bar */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === f.id
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">{error}</p>
            <button
              onClick={refresh}
              className="mt-3 text-xs text-zinc-500 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <ShowsSection
              title="Recommended Shows"
              items={filteredShows}
              selectedId={selectedId}
              loadingTrailerId={loadingTrailerId}
              onSelect={handleSelect}
              onPlayTrailer={handlePlayTrailer}
              loading={loading}
            />
            <ShowsSection
              title="Recommended Movies"
              items={filteredMovies}
              selectedId={selectedId}
              loadingTrailerId={loadingTrailerId}
              onSelect={handleSelect}
              onPlayTrailer={handlePlayTrailer}
              loading={loading}
            />
          </>
        )}
      </div>
    </main>
  );
}
