import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type Story = { title: string; url: string };

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return json({ error: "NEWS_API_KEY not set", stories: [] });
  }
  try {
    const res = await fetch(
      "https://newsapi.org/v2/top-headlines?category=business&country=us&pageSize=5&apiKey=" + key,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return json({ stories: [] });
    const data = await res.json();
    const list = (data.articles ?? [])
      .filter((a: { title?: string; url?: string }) => a.title && a.url)
      .slice(0, 3)
      .map((a: { title: string; url: string }) => ({ title: a.title, url: a.url })) as Story[];
    return json({ stories: list });
  } catch {
    return json({ stories: [] });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
