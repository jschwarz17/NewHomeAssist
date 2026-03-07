"use client";

import { ShowCard } from "./ShowCard";
import type { ShowCardProps } from "./ShowCard";

export interface ShowsSectionItem
  extends Omit<ShowCardProps, "isSelected" | "onSelect" | "onPlayTrailer" | "isLoadingTrailer"> {
  id: string;
  posterSearchQuery: string;
  trailerSearchQuery: string;
}

interface ShowsSectionProps {
  title: string;
  items: ShowsSectionItem[];
  selectedId: string | null;
  loadingTrailerId: string | null;
  onSelect: (id: string) => void;
  onPlayTrailer: (item: ShowsSectionItem) => void;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 flex gap-3 animate-pulse">
      <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg bg-zinc-800" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-5/6" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
      </div>
    </div>
  );
}

export function ShowsSection({
  title,
  items,
  selectedId,
  loadingTrailerId,
  onSelect,
  onPlayTrailer,
  loading = false,
}: ShowsSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3 px-1">
        {title}
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item) => (
              <ShowCard
                key={item.id}
                {...item}
                isSelected={selectedId === item.id}
                onSelect={() => onSelect(item.id)}
                onPlayTrailer={() => onPlayTrailer(item)}
                isLoadingTrailer={loadingTrailerId === item.id}
              />
            ))}
      </div>
    </section>
  );
}
