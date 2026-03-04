"use client";

import { useEffect, useState } from "react";

type Story = { title: string; url: string; image: string | null };

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export function IndieRockNewsWidget() {
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/indie-rock-news` : "/api/widgets/indie-rock-news";
    fetch(url)
      .then((res) => res.ok ? res.json() : { story: null })
      .then((data) => {
        if (data.story?.title && data.story?.url) setStory(data.story);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 px-4 pt-4 pb-2">
        Top indie rock news
      </h3>
      {loading ? (
        <p className="p-4 text-sm text-zinc-500">Loading…</p>
      ) : !story ? (
        <p className="p-4 text-sm text-zinc-500">Add NEWS_API_KEY on the server for live stories.</p>
      ) : (
        <a href={story.url} target="_blank" rel="noopener noreferrer" className="block">
          {story.image && (
            <img
              src={story.image}
              alt=""
              className="w-full h-36 object-cover"
            />
          )}
          <p className="p-4 text-sm text-zinc-300 hover:text-white underline underline-offset-2">
            {story.title}
          </p>
        </a>
      )}
    </div>
  );
}
