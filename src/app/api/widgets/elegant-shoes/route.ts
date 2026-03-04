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

/** Real elegant women's shoe photos from Unsplash with links to the photo page. */
export async function GET() {
  const key = process.env.UNSPLASH_ACCESS_KEY ?? "";
  if (!key) {
    return json({ error: "UNSPLASH_ACCESS_KEY not set", shoes: [] });
  }
  try {
    const res = await fetch(
      "https://api.unsplash.com/search/photos?query=elegant+women+shoes&per_page=6&orientation=square&client_id=" + key,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return json({ shoes: [] });
    const data = await res.json();
    const results = (data.results ?? []).slice(0, 6).map((p: { urls?: { small: string; regular: string }; links?: { html: string }; user?: { name: string }; alt_description?: string; description?: string }) => ({
      imageUrl: p.urls?.small ?? p.urls?.regular ?? "",
      link: p.links?.html ?? "https://unsplash.com/s/photos/elegant-women-shoes",
      credit: p.user?.name ?? "Unsplash",
      label: p.alt_description ?? p.description ?? "",
    }));
    return json({ shoes: results.filter((s: { imageUrl: string }) => s.imageUrl) });
  } catch {
    return json({ shoes: [] });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
