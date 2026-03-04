"use client";

import { useEffect, useState } from "react";

type Story = { title: string; url: string };

const FALLBACK: Story[] = [
  { title: "Fed signals steady rates as inflation eases", url: "https://www.reuters.com/markets/" },
  { title: "Major banks report strong Q3 earnings", url: "https://www.bloomberg.com/markets" },
  { title: "Fintech adoption hits new high in US", url: "https://techcrunch.com/" },
];

export function FintechNewsWidget() {
  const [stories, setStories] = useState<Story[]>(FALLBACK);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_NEWS_API_KEY ?? "";
    if (!key) return;
    fetch(
      "https://newsapi.org/v2/top-headlines?category=business&country=us&pageSize=3&apiKey=" + key
    )
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.articles?.length) return;
        const list = data.articles
          .filter((a: { title?: string; url?: string }) => a.title && a.url)
          .slice(0, 3)
          .map((a: { title: string; url: string }) => ({ title: a.title, url: a.url }));
        if (list.length) setStories(list);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Top fintech news (U.S.)
      </h3>
      <ul className="space-y-2">
        {stories.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-300 hover:text-white underline underline-offset-2"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
