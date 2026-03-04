"use client";

import { useEffect, useState } from "react";

const GLAMOUR_LINK = "https://www.glamour.com/";

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export function GlamourCoverWidget() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/glamour-cover` : "/api/widgets/glamour-cover";
    fetch(url)
      .then((res) => res.ok ? res.json() : { image: null })
      .then((data) => setImage(data.image ?? null))
      .catch(() => setImage(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 px-4 pt-4 pb-2">
        Glamour
      </h3>
      <a
        href={GLAMOUR_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-2"
      >
        {loading ? (
          <div className="w-28 h-36 mx-auto rounded bg-zinc-800 animate-pulse" />
        ) : image ? (
          <img
            src={image}
            alt="Glamour magazine cover"
            className="w-28 h-auto mx-auto rounded object-cover"
          />
        ) : (
          <span className="block w-28 mx-auto text-center text-sm text-zinc-400 py-8">
            Glamour
          </span>
        )}
      </a>
    </div>
  );
}
