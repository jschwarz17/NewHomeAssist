"use client";

import { useEffect, useState } from "react";

interface Quote {
  symbol: string;
  price: string;
  change?: string;
}

export function StockPricesWidget() {
  const [quotes, setQuotes] = useState<Quote[]>([
    { symbol: "CFG", price: "—" },
    { symbol: "NASDAQ", price: "—" },
    { symbol: "S&P 500", price: "—" },
  ]);

  useEffect(() => {
    async function fetchStocks() {
      try {
        const key =
          typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
            ? process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY
            : "";
        if (key) {
          const symbols = ["CFG", "IXIC", "SPX"];
          const results: Quote[] = [];
          for (const sym of symbols) {
            const res = await fetch(
              `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${key}`
            );
            if (res.ok) {
              const data = await res.json();
              const q = data["Global Quote"];
              if (q?.["05. price"]) {
                const label = sym === "IXIC" ? "NASDAQ" : sym === "SPX" ? "S&P 500" : sym;
                results.push({
                  symbol: label,
                  price: Number(q["05. price"]).toFixed(2),
                  change: q["10. change percent"] ? `${q["10. change percent"]}%` : undefined,
                });
              }
            }
          }
          if (results.length) setQuotes(results);
        }
      } catch {
        // keep placeholders
      }
    }
    fetchStocks();
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Markets
      </h3>
      <ul className="space-y-2">
        {quotes.map((q) => (
          <li key={q.symbol} className="flex justify-between items-baseline text-sm">
            <span className="text-zinc-400">{q.symbol}</span>
            <span className="text-white font-mono">{q.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
