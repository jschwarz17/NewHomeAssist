"use client";

import { useEffect, useState } from "react";

const FALLBACK = {
  title: "Indie rock scene thrives with new festival lineup",
  url: "https://pitchfork.com/",
  image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=240&fit=crop",
};

export function IndieRockNewsWidget() {
  const [story, setStory] = useState(FALLBACK);

  useEffect(() => {
    async function fetchNews() {
      try {
        const key =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_NEWS_API_KEY
            ? process.env.NEXT_PUBLIC_NEWS_API_KEY
            : "";
        if (key) {
          const res = await fetch(
            `https://newsapi.org/v2/everything?q=indie%20rock&language=en&sortBy=publishedAt&pageSize=1&apiKey=${key}`
          );
          if (res.ok) {
            const data = await res.json();
            const a = data.articles?.[0];
            if (a?.title && a?.url) {
              setStory({
                title: a.title,
                url: a.url,
                image: a.urlToImage || FALLBACK.image,
              });
              return;
            }
          }
        }
      } catch {
        // use fallback
      }
    }
    fetchNews();
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 px-4 pt-4 pb-2">
        Top indie rock news
      </h3>
      <a href={story.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={story.image}
          alt=""
          className="w-full h-36 object-cover"
        />
        <p className="p-4 text-sm text-zinc-300 hover:text-white underline underline-offset-2">
          {story.title}
        </p>
      </a>
    </div>
  );
}
