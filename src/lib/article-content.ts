export interface ExtractedArticle {
  title: string | null;
  content: string;
}

const BLOCK_TAG_PATTERN =
  /<\/(article|section|div|p|li|ul|ol|blockquote|h1|h2|h3|h4|h5|h6|tr)>/gi;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeTextFromHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(BLOCK_TAG_PATTERN, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function extractTitle(html: string): string | null {
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]).trim();
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim();
  }

  return null;
}

function extractMainContent(html: string): string {
  const candidates = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class=["'][^"']*(?:post-content|article-content|markup|body|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    const normalized = normalizeTextFromHtml(match[1]);
    if (normalized.length >= 300) {
      return normalized;
    }
  }

  return normalizeTextFromHtml(html);
}

export async function fetchExtractedArticle(url: string): Promise<ExtractedArticle> {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Only http and https article URLs are supported.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Ara Article Reader)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article (${response.status}).`);
  }

  const html = await response.text();
  const content = extractMainContent(html).slice(0, 30000);

  if (!content) {
    throw new Error("Could not extract article text.");
  }

  return {
    title: extractTitle(html),
    content,
  };
}
