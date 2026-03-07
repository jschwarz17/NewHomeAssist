"use client";

import Image from "next/image";

export interface ShowCardProps {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  streamingService: string;
  posterUrl: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onPlayTrailer: () => void;
  isLoadingTrailer: boolean;
}

export function ShowCard({
  title,
  year,
  type,
  description,
  genre,
  streamingService,
  posterUrl,
  isSelected,
  onSelect,
  onPlayTrailer,
  isLoadingTrailer,
}: ShowCardProps) {
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
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              width={72}
              height={108}
              className="object-cover w-full h-full"
              unoptimized
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
          </div>

          <p className="text-zinc-400 text-xs mt-1.5 line-clamp-3 leading-relaxed">
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
          </div>
        </div>
      )}
    </div>
  );
}
