"use client";

import { useEffect, useState } from "react";
import { openLink } from "@/lib/open-link";

type Shoe = { imageUrl: string; link: string; credit?: string };

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

const FALLBACK_IMAGES = [
  { imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop", link: "https://unsplash.com/s/photos/elegant-women-shoes" },
  { imageUrl: "https://images.unsplash.com/photo-1535043934128-cf0b31cfbaa7?w=200&h=200&fit=crop", link: "https://unsplash.com/s/photos/elegant-women-shoes" },
  { imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&h=200&fit=crop", link: "https://unsplash.com/s/photos/elegant-women-shoes" },
];

export function ElegantShoesWidget() {
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/elegant-shoes` : "/api/widgets/elegant-shoes";
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
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
              className="block"
            >
              <img
                src={shoe.imageUrl}
                alt=""
                className="w-20 h-20 rounded object-cover border border-zinc-800 hover:border-zinc-600 transition-colors"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
