"use client";

const SHOES = [
  "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1535043934128-cf0b31cfbaa7?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&h=200&fit=crop",
];

export function ElegantShoesWidget() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Elegant picks
      </h3>
      <div className="flex gap-2 justify-center flex-wrap">
        {SHOES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="w-20 h-20 rounded object-cover border border-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
