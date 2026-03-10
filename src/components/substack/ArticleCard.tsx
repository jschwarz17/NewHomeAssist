"use client";

import React from "react";
import type { SubstackArticle } from "@/context/SubstackContext";

export interface ArticleCardProps extends SubstackArticle {
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  onOpenArticle: () => void;
}

export function ArticleCard({
  title,
  description,
  category,
  isPlaying,
  isLoading,
  onPlay,
  onOpenArticle,
}: ArticleCardProps) {
  const categoryColors = {
    AI: "bg-blue-900/40 text-blue-400",
    Politics: "bg-red-900/40 text-red-400",
    Fintech: "bg-green-900/40 text-green-400",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 flex-1">
          {title}
        </h3>
        <span className={`text-[10px] px-2 py-1 rounded ${categoryColors[category]}`}>
          {category}
        </span>
      </div>

      <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3 mb-3">
        {description}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={onPlay}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <span>{isPlaying ? "■" : "▶"}</span>
              {isPlaying ? "Stop Ara" : "Read with Ara"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenArticle}
          className="text-xs text-zinc-500 hover:text-zinc-400 underline"
        >
          Full article →
        </button>
      </div>
    </div>
  );
}
