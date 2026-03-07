"use client";

import { useEffect, useState, useCallback } from "react";
import { useYouTube } from "@/context/YouTubeContext";
import { ShowsSection } from "@/components/shows/ShowsSection";
import type { ShowsSectionItem } from "@/components/shows/ShowsSection";

interface ShowItem {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  streamingService: string;
  posterSearchQuery: string;
  trailerSearchQuery: string;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

function toSectionItem(item: ShowItem, index: number): ShowsSectionItem {
  return {
    id: `${item.type}-${index}`,
    title: item.title,
    year: item.year,
    type: item.type,
    description: item.description,
    genre: item.genre,
    streamingService: item.streamingService,
    posterSearchQuery: item.posterSearchQuery,
    trailerSearchQuery: item.trailerSearchQuery,
    posterUrl: null,
  };
}

export default function ShowsPage() {
  const { playVideo } = useYouTube();

  const [shows, setShows] = useState<ShowsSectionItem[]>([]);
  const [movies, setMovies] = useState<ShowsSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingTrailerId, setLoadingTrailerId] = useState<string | null>(null);

  // ── Fetch recommendations ─────────────────────────────────────────────────
  useEffect(() => {
    const base = getApiBase();
    const url = base
      ? `${base}/api/shows/recommendations/`
      : "/api/shows/recommendations";

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: { shows: ShowItem[]; movies: ShowItem[] }) => {
        const showItems = (data.shows ?? []).map((s, i) => toSectionItem(s, i));
        const movieItems = (data.movies ?? []).map((m, i) =>
          toSectionItem(m, i)
        );
        setShows(showItems);
        setMovies(movieItems);
        fetchPosters(showItems, setShows, base);
        fetchPosters(movieItems, setMovies, base);
      })
      .catch((e) => {
        console.error("[shows] recommendations error:", e);
        setError("Couldn't load recommendations. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch posters in parallel ─────────────────────────────────────────────
  function fetchPosters(
    items: ShowsSectionItem[],
    setter: React.Dispatch<React.SetStateAction<ShowsSectionItem[]>>,
    base: string
  ) {
    items.forEach((item) => {
      const url = base
        ? `${base}/api/shows/poster/?query=${encodeURIComponent(item.posterSearchQuery)}&type=${item.type}`
        : `/api/shows/poster?query=${encodeURIComponent(item.posterSearchQuery)}&type=${item.type}`;

      fetch(url)
        .then((r) => (r.ok ? r.json() : { poster: null }))
        .then((data: { poster: string | null }) => {
          if (!data.poster) return;
          setter((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, posterUrl: data.poster } : p
            )
          );
        })
        .catch(() => {});
    });
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

  // ── Handle card selection (toggle) ────────────────────────────────────────
  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 bg-black min-h-screen px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {error ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-zinc-400 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-xs text-zinc-500 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <ShowsSection
              title="Recommended Shows"
              items={shows}
              selectedId={selectedId}
              loadingTrailerId={loadingTrailerId}
              onSelect={handleSelect}
              onPlayTrailer={handlePlayTrailer}
              loading={loading}
            />
            <ShowsSection
              title="Recommended Movies"
              items={movies}
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
