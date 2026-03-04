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

const NEGATIVE_KEYWORDS = [
  "obesity", "obese", "death", "dies", "died", "fatal", "kill",
  "abuse", "neglect", "lawsuit", "recall", "warning", "danger",
  "crisis", "epidemic", "famine", "drought", "war", "conflict",
  "poverty", "malnutrition", "starv", "disease outbreak",
];

function isPositiveArticle(article: { title?: string; description?: string }): boolean {
  const text = `${article.title ?? ""} ${article.description ?? ""}`.toLowerCase();
  return !NEGATIVE_KEYWORDS.some((kw) => text.includes(kw));
}

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return json({ error: "NEWS_API_KEY not set", article: null });
  }
  try {
    const query = encodeURIComponent(
      '"baby tips" OR "newborn care" OR "infant development" OR "baby milestones" OR "baby nutrition"'
    );
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${key}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return json({ article: null });
    const data = await res.json();
    const articles = (data.articles ?? []) as { title?: string; url?: string; description?: string; source?: { name?: string } }[];
    const a = articles.find(
      (x) => x.title && x.url && isPositiveArticle(x)
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
