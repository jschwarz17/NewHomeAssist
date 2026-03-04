import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/** One real article about baby health; return title, url, and first few lines (description or content excerpt). */
export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return json({ error: "NEWS_API_KEY not set", article: null });
  }
  try {
    const res = await fetch(
      "https://newsapi.org/v2/everything?q=healthy+baby+tips+OR+infant+health&language=en&sortBy=publishedAt&pageSize=3&apiKey=" + key,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return json({ article: null });
    const data = await res.json();
    const a = (data.articles ?? []).find(
      (x: { title?: string; url?: string; description?: string }) => x.title && x.url
    );
    if (!a) return json({ article: null });
    const description = (a.description ?? "").trim();
    const excerpt = description
      ? description.slice(0, 280) + (description.length > 280 ? "…" : "")
      : "";
    return json({
      article: {
        title: a.title,
        url: a.url,
        excerpt,
        source: a.source?.name ?? "",
      },
    });
  } catch {
    return json({ article: null });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
