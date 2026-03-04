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

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return json({ error: "NEWS_API_KEY not set", story: null });
  }
  try {
    const res = await fetch(
      "https://newsapi.org/v2/everything?q=indie%20rock&language=en&sortBy=publishedAt&pageSize=3&apiKey=" + key,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return json({ story: null });
    const data = await res.json();
    const a = (data.articles ?? []).find((x: { title?: string; url?: string }) => x.title && x.url);
    if (!a) return json({ story: null });
    return json({
      story: {
        title: a.title,
        url: a.url,
        image: a.urlToImage ?? null,
      },
    });
  } catch {
    return json({ story: null });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
