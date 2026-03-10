"use client";

import { useEffect } from "react";
import type { SubstackArticle } from "@/context/SubstackContext";

interface ArticleModalProps {
  article: SubstackArticle | null;
  content: string;
  loading: boolean;
  error: string | null;
  isReading: boolean;
  playbackStatus: string | null;
  onClose: () => void;
  onReadAloud: () => void;
  onStopReading: () => void;
}

export function ArticleModal({
  article,
  content,
  loading,
  error,
  isReading,
  playbackStatus,
  onClose,
  onReadAloud,
  onStopReading,
}: ArticleModalProps) {
  useEffect(() => {
    if (!article) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [article, onClose]);

  if (!article) return null;

  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4 py-6">
        <div className="max-h-[88vh] w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {article.category}
                </span>
                {playbackStatus && (
                  <span className="rounded-full bg-emerald-900/40 px-2 py-1 text-[10px] font-medium text-emerald-400">
                    {playbackStatus}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-white">{article.title}</h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-zinc-800 px-5 py-3">
            <button
              type="button"
              onClick={isReading ? onStopReading : onReadAloud}
              disabled={loading}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Loading article..."
                : isReading
                  ? "Stop Ara"
                  : "Read with Ara"}
            </button>

            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Open original
            </a>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-5/6 rounded bg-zinc-800" />
                <div className="h-4 w-full rounded bg-zinc-800" />
                <div className="h-4 w-4/5 rounded bg-zinc-800" />
                <div className="h-4 w-full rounded bg-zinc-800" />
              </div>
            ) : error ? (
              <p className="text-sm text-rose-400">{error}</p>
            ) : paragraphs.length > 0 ? (
              <div className="space-y-4">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${article.link}-${index}`} className="text-sm leading-7 text-zinc-300">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No article text was extracted.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
