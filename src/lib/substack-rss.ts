/**
 * Fetch and parse Substack RSS feeds for free articles.
 */

export interface SubstackArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: "AI" | "Politics" | "Fintech";
  fullContent?: string;
}

const SUBSTACK_FEEDS = {
  AI: [
    "https://thebatch.substack.com/feed", // Andrew Ng's The Batch
    "https://lastweekin.ai/feed", // Last Week in AI
    "https://www.theinsaneapp.com/feed", // The Insane App
  ],
  Politics: [
    "https://www.thefp.com/feed", // The Free Press (center-right, not left-leaning)
    "https://www.commentary.org/feed", // Commentary Magazine (center-right)
    "https://www.nationalreview.com/feed", // National Review (conservative)
  ],
  Fintech: [
    "https://www.fintechfutures.com/feed", // Fintech Futures
    "https://www.fintechnews.org/feed", // Fintech News
    "https://www.fintechweekly.com/feed", // Fintech Weekly
  ],
};

/**
 * Parse RSS XML and extract articles.
 * Uses regex-based parsing for server-side compatibility.
 */
function parseRSS(xmlText: string, category: "AI" | "Politics" | "Fintech"): SubstackArticle[] {
  const articles: SubstackArticle[] = [];
  
  // Extract all <item> blocks
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const items = xmlText.match(itemRegex) || [];

  items.forEach((itemXml) => {
    const getTagContent = (tagName: string): string => {
      const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, "i");
      const match = itemXml.match(regex);
      if (!match) return "";
      // Remove CDATA wrapper if present
      let content = match[1].trim();
      if (content.startsWith("<![CDATA[")) {
        content = content.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
      }
      // Remove HTML tags
      return content.replace(/<[^>]+>/g, "").trim();
    };

    const title = getTagContent("title");
    const description = getTagContent("description");
    const link = getTagContent("link");
    const pubDate = getTagContent("pubDate");

    // Check if article is free (not behind paywall)
    const isFree = !description.toLowerCase().includes("premium") &&
                   !description.toLowerCase().includes("paid subscriber") &&
                   !description.toLowerCase().includes("subscribe to read") &&
                   !title.toLowerCase().includes("premium");

    if (isFree && title && link) {
      // Get first few sentences (approximately 300 chars)
      const shortDesc = description.slice(0, 300);
      const lastPeriod = shortDesc.lastIndexOf(".");
      const finalDesc = lastPeriod > 0 ? shortDesc.slice(0, lastPeriod + 1) : shortDesc;

      articles.push({
        title,
        description: finalDesc,
        link,
        pubDate,
        category,
      });
    }
  });

  return articles;
}

/**
 * Fetch articles from multiple RSS feeds for a category.
 */
async function fetchCategoryArticles(category: "AI" | "Politics" | "Fintech"): Promise<SubstackArticle[]> {
  const feeds = SUBSTACK_FEEDS[category];
  const allArticles: SubstackArticle[] = [];

  for (const feedUrl of feeds) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; RSS Reader)",
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const xmlText = await response.text();
      const articles = parseRSS(xmlText, category);
      allArticles.push(...articles);
    } catch (error) {
      console.error(`[substack-rss] Error fetching ${feedUrl}:`, error);
      // Continue with other feeds
    }
  }

  // Sort by pubDate (newest first) and return top 10
  return allArticles
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 10);
}

/**
 * Fetch top articles from all categories.
 */
export async function fetchSubstackArticles(): Promise<{
  ai: SubstackArticle[];
  politics: SubstackArticle[];
  fintech: SubstackArticle[];
}> {
  const [ai, politics, fintech] = await Promise.all([
    fetchCategoryArticles("AI"),
    fetchCategoryArticles("Politics"),
    fetchCategoryArticles("Fintech"),
  ]);

  return { ai, politics, fintech };
}

/**
 * Fetch full article content for text-to-speech.
 * This is a simplified version - in production, you might want to use a service
 * that can extract article content from URLs.
 */
export async function fetchArticleContent(url: string): Promise<string> {
  try {
    // Use a CORS proxy or server-side fetch
    const response = await fetch(`/api/substack/article-content?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch article content");
    }
    const data = await response.json();
    return data.content || "";
  } catch (error) {
    console.error("[substack-rss] Error fetching article content:", error);
    return "";
  }
}
