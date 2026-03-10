"use client";

import Image from "next/image";
import React from "react";
import type { ShowMood } from "@/context/ShowsContext";

export interface ShowCardProps {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  country: string;
  language: string;
  streamingService: string;
  posterUrl: string | null;
  trailerVideoId: string | null;
  tmdbSearchTitle?: string;
  mood: ShowMood;
  isSelected: boolean;
  onSelect: () => void;
  onPlayTrailer: () => void;
  onOpenTrailer: () => void;
  isLoadingTrailer: boolean;
}

const MOOD_STYLES: Record<ShowMood, string> = {
  fun: "bg-amber-900/40 text-amber-400",
  gritty: "bg-red-900/40 text-red-400",
  quirky: "bg-purple-900/40 text-purple-400",
  funny: "bg-green-900/40 text-green-400",
  suspenseful: "bg-blue-900/40 text-blue-400",
};

export function ShowCard({
  title,
  year,
  type,
  description,
  genre,
  country,
  language,
  streamingService,
  posterUrl,
  trailerVideoId,
  tmdbSearchTitle,
  mood,
  isSelected,
  onSelect,
  onPlayTrailer,
  onOpenTrailer,
  isLoadingTrailer,
}: ShowCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const [resolvedPoster, setResolvedPoster] = React.useState<string | null>(posterUrl ?? null);

  React.useEffect(() => {
    setImgError(false);
    setResolvedPoster(posterUrl ?? null);
  }, [posterUrl]);

  // Hydrate poster when missing: fetch from poster API
  React.useEffect(() => {
    if (resolvedPoster || !tmdbSearchTitle) return;
    const query = (tmdbSearchTitle || title).trim();
    if (!query) return;
    const base = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "") : "";
    const url = base ? `${base}/api/shows/poster/` : "/api/shows/poster/";
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("type", type);
    if (year) params.set("year", year);
    fetch(`${url}?${params}`)
      .then((r) => r.json())
      .then((data: { poster?: string | null }) => {
        if (data.poster && data.poster.startsWith("http")) {
          setResolvedPoster(data.poster);
        }
      })
      .catch(() => {});
  }, [resolvedPoster, tmdbSearchTitle, title, type, year]);
  const isInternational = language && language.toLowerCase() !== "english";
  return (
    <div
      className={`rounded-xl border bg-zinc-950 transition-colors cursor-pointer ${
        isSelected ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700"
      }`}
      onClick={onSelect}
    >
      <div className="flex gap-3 p-3">
        {/* Poster */}
        <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg overflow-hidden bg-zinc-800">
          {(resolvedPoster || posterUrl) && !imgError ? (
            <Image
              src={resolvedPoster || posterUrl || ""}
              alt={title}
              width={72}
              height={108}
              className="object-cover w-full h-full"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-zinc-600 text-xs text-center px-1">
                {type === "movie" ? "🎬" : "📺"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2">
            {title}
          </h3>

          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {year}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {genre}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${MOOD_STYLES[mood] ?? "bg-zinc-800 text-zinc-400"}`}
            >
              {mood}
            </span>
            {isInternational && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-300 border border-zinc-600">
                {country}
              </span>
            )}
          </div>

          <p className={`text-zinc-400 text-xs mt-1.5 leading-relaxed ${isSelected ? "" : "line-clamp-3"}`}>
            {description}
          </p>

          <div className="mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700 text-zinc-500">
              {streamingService}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded: action button */}
      {isSelected && (
        <div
          className="px-3 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-t border-zinc-800 pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={onPlayTrailer}
                disabled={isLoadingTrailer}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-white text-sm font-medium disabled:opacity-50"
              >
                {isLoadingTrailer ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
                    Finding trailer…
                  </>
                ) : (
                  <>
                    <span>▶</span>
                    Play Trailer
                  </>
                )}
              </button>
              <button
                onClick={onOpenTrailer}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 hover:bg-zinc-900 active:bg-zinc-800 transition-colors text-zinc-200 text-sm font-medium"
              >
                <span>{trailerVideoId ? "↗" : "🔎"}</span>
                {trailerVideoId ? "Open on YouTube" : "Search Trailer"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              {streamingService} • {language}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
