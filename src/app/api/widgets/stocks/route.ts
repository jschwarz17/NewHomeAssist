import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Use ETFs for indices so Alpha Vantage GLOBAL_QUOTE returns data (SPY ≈ S&P 500, QQQ ≈ NASDAQ-100)
const SYMBOLS = [
  { symbol: "CFG", label: "CFG", logoUrl: "https://logo.clearbit.com/citizensbank.com" },
  { symbol: "QQQ", label: "NASDAQ", logoUrl: "https://logo.clearbit.com/nasdaq.com" },
  { symbol: "SPY", label: "S&P 500", logoUrl: "https://logo.clearbit.com/ssga.com" },
] as const;

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function GET() {
  const key = process.env.ALPHA_VANTAGE_KEY ?? process.env.ALPHA_VANTAGE_API_KEY ?? "";
  if (!key) {
    return json({ error: "ALPHA_VANTAGE_KEY not set", quotes: [] });
  }
  const quotes: { symbol: string; price: string; change?: string; logoUrl?: string }[] = [];
  const results = await Promise.all(
    SYMBOLS.map(async ({ symbol, label }) => {
      try {
        const res = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const q = data["Global Quote"];
        if (q?.["05. price"]) {
          const price = Number(q["05. price"]).toFixed(2);
          const change = q["10. change percent"] ? `${q["10. change percent"]}%` : undefined;
          return { symbol: label, price, change, logoUrl: SYMBOLS.find((s) => s.label === label)?.logoUrl };
        }
      } catch {
        // skip
      }
      return null;
    })
  );
  results.forEach((r) => {
    if (r) quotes.push(r);
  });
  return json({ quotes });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
