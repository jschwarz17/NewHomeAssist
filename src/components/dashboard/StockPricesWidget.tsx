"use client";

import { useEffect, useState } from "react";

interface Quote {
  symbol: string;
  price: string;
  change?: string;
}

const PLACEHOLDER: Quote[] = [
  { symbol: "CFG", price: "—" },
  { symbol: "NASDAQ", price: "—" },
  { symbol: "S&P 500", price: "—" },
];

function getWidgetsBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export function StockPricesWidget() {
  const [quotes, setQuotes] = useState<Quote[]>(PLACEHOLDER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getWidgetsBase();
    const url = base ? `${base}/api/widgets/stocks/` : "/api/widgets/stocks";
    fetch(url)
      .then((res) => res.ok ? res.json() : { quotes: [] })
      .then((data) => {
        if (Array.isArray(data.quotes) && data.quotes.length > 0) {
          setQuotes(data.quotes);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Markets
      </h3>
      {loading && quotes.every((q) => q.price === "—") ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : null}
      <ul className="space-y-2">
        {quotes.map((q) => (
          <li key={q.symbol} className="flex justify-between items-baseline text-sm">
            <span className="text-zinc-400">{q.symbol}</span>
            <span className="text-white font-mono">{q.price}</span>
          </li>
        ))}
      </ul>
      {!loading && quotes.every((q) => q.price === "—") && (
        <p className="text-xs text-zinc-500 mt-2">
          In .env.local set NEXT_PUBLIC_ASSISTANT_API_URL to your Vercel URL, then rebuild. On Vercel, set ALPHA_VANTAGE_KEY.
        </p>
      )}
    </div>
  );
}
