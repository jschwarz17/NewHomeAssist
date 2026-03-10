"use client";

import { ArticleCard } from "./ArticleCard";
import type { SubstackArticle } from "@/context/SubstackContext";

interface ArticlesSectionProps {
  title: string;
  articles: SubstackArticle[];
  playingUrl: string | null;
  loadingUrl: string | null;
  onPlay: (article: SubstackArticle) => void;
  onOpenArticle: (article: SubstackArticle) => void;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-5 bg-zinc-800 rounded w-16" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-5/6" />
        <div className="h-3 bg-zinc-800 rounded w-4/5" />
      </div>
      <div className="h-8 bg-zinc-800 rounded w-24" />
    </div>
  );
}

export function ArticlesSection({
  title,
  articles,
  playingUrl,
  loadingUrl,
  onPlay,
  onOpenArticle,
  loading = false,
}: ArticlesSectionProps) {
  if (!loading && articles.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3 px-1">
        {title}
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((article) => (
              <ArticleCard
                key={article.link}
                {...article}
                isPlaying={playingUrl === article.link}
                isLoading={loadingUrl === article.link}
                onPlay={() => onPlay(article)}
                onOpenArticle={() => onOpenArticle(article)}
              />
            ))}
      </div>
    </section>
  );
}
