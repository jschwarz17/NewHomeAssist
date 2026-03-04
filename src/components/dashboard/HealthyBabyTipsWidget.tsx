"use client";

import { useEffect, useState } from "react";
import { openLink } from "@/lib/open-link";

type Article = { title: string; url: string; excerpt: string; source?: string };

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

const FALLBACK_TIPS = [
  "Keep a consistent sleep routine for better baby rest.",
  "Offer a variety of textures when starting solids.",
  "Talk and read to your baby daily to support language.",
];

export function HealthyBabyTipsWidget() {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/baby-tips` : "/api/widgets/baby-tips";
    fetch(url)
      .then((res) => res.ok ? res.json() : { article: null })
      .then((data) => {
        if (data.article?.title && data.article?.url) setArticle(data.article);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Tips for a healthy baby
      </h3>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : article ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => openLink(article.url)}
            className="text-sm font-medium text-zinc-200 hover:text-white underline underline-offset-2 block text-left"
          >
            {article.title}
          </button>
          {article.excerpt && (
            <p className="text-sm text-zinc-400 leading-snug">{article.excerpt}</p>
          )}
          {article.source && (
            <p className="text-xs text-zinc-500">{article.source}</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {FALLBACK_TIPS.map((tip, i) => (
            <li key={i} className="text-sm text-zinc-300">
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
