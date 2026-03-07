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

const MUSIC_KEYWORDS = [
  "band", "album", "single", "track", "song", "music", "artist",
  "tour", "concert", "release", "label", "ep", "lp", "indie",
  "festival", "record", "listen", "stream", "guitar", "vocalist",
  "debut", "playlist", "gig", "soundcloud", "spotify",
];

const EXCLUDE_KEYWORDS = [
  "restaurant", "diner", "café", "cafe", "food", "recipe", "menu",
  "bar opening", "sports", "nfl", "nba", "soccer",
];

function isIndieRockArticle(article: { title?: string; description?: string }): boolean {
  const text = `${article.title ?? ""} ${article.description ?? ""}`.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((kw) => text.includes(kw))) return false;
  return MUSIC_KEYWORDS.some((kw) => text.includes(kw));
}

export async function GET() {
  const key = process.env.NEWS_API_KEY ?? "";
  if (!key) {
    return json({ error: "NEWS_API_KEY not set", story: null });
  }
  try {
    const query = encodeURIComponent('"indie rock" (band OR album OR artist OR music OR concert OR tour OR release)');
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${key}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return json({ story: null });
    const data = await res.json();
    const a = (data.articles ?? []).find(
      (x: { title?: string; url?: string; description?: string }) => x.title && x.url && isIndieRockArticle(x)
    );
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
