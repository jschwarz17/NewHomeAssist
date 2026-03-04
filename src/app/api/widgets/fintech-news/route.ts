import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Story = { title: string; url: string };

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return NextResponse.json(
      { error: "NEWS_API_KEY not set", stories: [] },
      { status: 200 }
    );
  }
  try {
    const res = await fetch(
      "https://newsapi.org/v2/top-headlines?category=business&country=us&pageSize=5&apiKey=" + key,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return NextResponse.json({ stories: [] }, { status: 200 });
    const data = await res.json();
    const list = (data.articles ?? [])
      .filter((a: { title?: string; url?: string }) => a.title && a.url)
      .slice(0, 3)
      .map((a: { title: string; url: string }) => ({ title: a.title, url: a.url })) as Story[];
    return NextResponse.json({ stories: list });
  } catch {
    return NextResponse.json({ stories: [] }, { status: 200 });
  }
}
