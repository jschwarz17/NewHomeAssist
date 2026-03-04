import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return NextResponse.json(
      { error: "NEWS_API_KEY not set", story: null },
      { status: 200 }
    );
  }
  try {
    const res = await fetch(
      "https://newsapi.org/v2/everything?q=indie%20rock&language=en&sortBy=publishedAt&pageSize=3&apiKey=" + key,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return NextResponse.json({ story: null }, { status: 200 });
    const data = await res.json();
    const a = (data.articles ?? []).find((x: { title?: string; url?: string }) => x.title && x.url);
    if (!a) return NextResponse.json({ story: null }, { status: 200 });
    return NextResponse.json({
      story: {
        title: a.title,
        url: a.url,
        image: a.urlToImage ?? null,
      },
    });
  } catch {
    return NextResponse.json({ story: null }, { status: 200 });
  }
}
