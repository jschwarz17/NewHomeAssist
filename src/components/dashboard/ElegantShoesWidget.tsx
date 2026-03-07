"use client";

import { useEffect, useState } from "react";
import { openLink } from "@/lib/open-link";

type Shoe = { imageUrl: string; link: string; credit?: string; label?: string };

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

const FALLBACK_IMAGES: Shoe[] = [
  { imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop&q=80", link: "https://unsplash.com/s/photos/elegant-women-shoes", label: "Classic heels" },
  { imageUrl: "https://images.unsplash.com/photo-1605812860427-4024433a70fd?w=200&h=200&fit=crop&q=80", link: "https://unsplash.com/s/photos/leather-boots", label: "Leather boots" },
  { imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&h=200&fit=crop&q=80", link: "https://unsplash.com/s/photos/elegant-women-shoes", label: "Sneakers" },
];

// Secondary fallback URLs tried if the primary fails
const RESERVE_URLS: Record<string, string> = {
  "Leather boots": "https://images.unsplash.com/photo-1539185441755-769473a23570?w=200&h=200&fit=crop&q=80",
  "Classic heels": "https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=200&h=200&fit=crop&q=80",
  "Sneakers": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&q=80",
};

function ShoeImage({ shoe }: { shoe: Shoe }) {
  const [attempt, setAttempt] = useState(0);

  const currentSrc =
    attempt === 0
      ? shoe.imageUrl
      : attempt === 1 && shoe.label && RESERVE_URLS[shoe.label]
      ? RESERVE_URLS[shoe.label]
      : null;

  if (currentSrc === null) {
    return (
      <div className="w-20 h-20 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <span className="text-zinc-600 text-lg">👟</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={shoe.label ?? "Shoe"}
      onError={() => setAttempt((n) => n + 1)}
      className="w-20 h-20 rounded object-cover border border-zinc-800 hover:border-zinc-600 transition-colors"
    />
  );
}

export function ElegantShoesWidget() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/elegant-shoes/` : "/api/widgets/elegant-shoes";
    fetch(url)
      .then((res) => res.ok ? res.json() : { shoes: [] })
      .then((data) => {
        const list = Array.isArray(data.shoes) ? data.shoes : [];
        if (list.length) setShoes(list);
        else setShoes(FALLBACK_IMAGES);
      })
      .catch(() => setShoes(FALLBACK_IMAGES))
      .finally(() => setLoading(false));
  }, []);

  const display = shoes.length ? shoes : FALLBACK_IMAGES;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
        Elegant picks
      </h3>
      {loading ? (
        <div className="flex gap-2 justify-center flex-wrap">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 rounded bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 justify-center flex-wrap">
          {display.slice(0, 6).map((shoe, i) => (
            <button
              key={i}
              type="button"
              onClick={() => openLink(shoe.link)}
              className="block w-20 text-center"
            >
              <ShoeImage shoe={shoe} />
              {shoe.label && (
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1 leading-tight">
                  {shoe.label}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
