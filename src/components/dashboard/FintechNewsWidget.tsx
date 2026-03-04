"use client";

import { useEffect, useState } from "react";
import { openLink } from "@/lib/open-link";

type Story = { title: string; url: string };

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export function FintechNewsWidget() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/fintech-news/` : "/api/widgets/fintech-news";
    fetch(url)
      .then((res) => res.ok ? res.json() : { stories: [] })
      .then((data) => {
        const list = Array.isArray(data.stories) ? data.stories : [];
        setStories(list.filter((s: Story) => s.title && s.url));
      })
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Top fintech news (U.S.)
      </h3>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : stories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          In .env.local set NEXT_PUBLIC_ASSISTANT_API_URL to your Vercel URL, then rebuild. On Vercel, set NEWS_API_KEY.
        </p>
      ) : (
        <ul className="space-y-2">
          {stories.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => openLink(s.url)}
                className="text-sm text-zinc-300 hover:text-white underline underline-offset-2 text-left"
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
