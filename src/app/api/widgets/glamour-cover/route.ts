import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const GLAMOUR_LINK = "https://www.glamour.com/";
const MAGAZINE_PAGES = [
  "https://www.glamour.com/magazine",
  "https://www.glamour.com/",
];

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

function extractOgImage(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return og?.[1] ?? null;
}

/** Look for magazine cover: ld+json or image with "cover" in class */
function extractMagazineCover(html: string): string | null {
  const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) {
    for (const block of jsonLd) {
      const src = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      try {
        const data = JSON.parse(src);
        const image = data.image?.url ?? data.image ?? data.thumbnailUrl;
        if (image && typeof image === "string") return image;
        if (Array.isArray(data["@graph"])) {
          for (const node of data["@graph"]) {
            const img = node.image?.url ?? node.image ?? node.thumbnailUrl;
            if (img && typeof img === "string") return img;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  const imgTag = html.match(/<img[^>]+class=["'][^"']*cover[^"']*["'][^>]+src=["']([^"']+)["']/i)
    ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*cover[^"']*["']/i);
  return imgTag?.[1] ?? null;
}

/** Real Glamour magazine: try /magazine for current cover, then homepage og:image */
export async function GET() {
  const ua = "Mozilla/5.0 (compatible; AraHomeAssist/1.0)";
  for (const url of MAGAZINE_PAGES) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua }, next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const html = await res.text();
      const cover = extractMagazineCover(html) ?? extractOgImage(html);
      if (cover) return json({ link: GLAMOUR_LINK, image: cover });
    } catch {
      continue;
    }
  }
  return json({ link: GLAMOUR_LINK, image: null });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
