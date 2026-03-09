"use client";

import React, { useState } from "react";
import type { SubstackArticle } from "@/context/SubstackContext";

export interface ArticleCardProps extends SubstackArticle {
  isPlaying: boolean;
  onPlay: () => void;
}

export function ArticleCard({
  title,
  description,
  link,
  category,
  isPlaying,
  onPlay,
}: ArticleCardProps) {
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const handlePlay = async () => {
    setIsLoadingContent(true);
    try {
      // Fetch article content and send to read-aloud API
      const response = await fetch("/api/substack/article-content?url=" + encodeURIComponent(link));
      const data = await response.json();
      
      if (data.content) {
        const readResponse = await fetch("/api/substack/read-aloud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: data.content, title }),
        });
        const readData = await readResponse.json();
        
        if (readData.success) {
          // Use Web Speech API to read the text
          if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(readData.audioText || data.content);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
            onPlay();
          }
        }
      }
    } catch (error) {
      console.error("[ArticleCard] Error reading article:", error);
    } finally {
      setIsLoadingContent(false);
    }
  };

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
          onClick={handlePlay}
          disabled={isLoadingContent || isPlaying}
          className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingContent ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <span>▶</span>
              Read Aloud
            </>
          )}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-400 underline"
        >
          Read full article →
        </a>
      </div>
    </div>
  );
}
