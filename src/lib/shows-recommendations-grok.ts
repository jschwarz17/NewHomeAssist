/**
 * Single Grok API call for Ara recommendations. Used by the recommendations route and the 6am cron.
 */

export type ShowMood = "fun" | "gritty" | "quirky" | "funny" | "suspenseful";

export interface ShowItem {
  title: string;
  year: string;
  type: "movie" | "show";
  description: string;
  genre: string;
  country: string;
  language: string;
  streamingService: string;
  tmdbSearchTitle: string;
  trailerSearchQuery: string;
  mood: ShowMood;
  posterUrl: string | null;
}

export interface RecommendationsResult {
  shows: ShowItem[];
  movies: ShowItem[];
  cachedAt: number;
  version: number;
}

const ARA_SYSTEM_PROMPT = `You are Ara, my personal curator for gritty, edgy, fast-paced, non-woke TV shows and movies. I only want the vibe of: Ozark, Caught Stealing, the German Netflix show Unfamiliar, Barry (dark, weird, edgy humor), and movies like The Social Network. Think intense pacing, morally gray characters, dark themes, sharp dialogue, no preaching, no forced diversity lectures, no social-justice messaging — just raw, smart, cynical, high-stakes storytelling. Also brilliant, quirky, layered comedies with sharp, absurd, dysfunctional family or character humor like Arrested Development — think clever meta jokes, eccentric weirdos, rapid-fire wit, and dark/understated edge without any preachiness. For comedies, 2-3 comedies among the total 20 recommendations.

Your task: Recommend ONLY shows and movies that (1) were released in the current calendar year or the previous calendar year (check the actual current date right now to know what "this year" and "last year" are — do NOT use 2025/2026 if the date has changed), (2) are already available to stream right now on major platforms (Netflix, Prime Video, Hulu, Max, Disney+, Apple TV+, Paramount+, etc.), and (3) perfectly match the gritty/edgy/non-woke vibe above.

Return EXACTLY:

10 TV shows
10 movies

Among the 20 total recommendations, exactly 5 must be European productions (Germany, UK, France, Spain, Scandinavia, Eastern Europe, etc. — clearly label the country). The other 15 must be American productions.

Output format (strictly follow this, no extra text, no lists outside the sections):

TV SHOWS (10 total)

Title (Year) — Country
[Insert official main poster image here using Grok's image search/render capability — only the real poster, large and clear]
3-line description:
Line 1: One-sentence hook.
Line 2: Why it's gritty/edgy/fast and matches my vibe.
Line 3: Current streaming platform(s).

(Repeat exactly the same format for 2–10)

MOVIES (10 total)

Title (Year) — Country
[Insert official main poster image here using Grok's image search/render capability — only the real poster, large and clear]
3-line description:
Line 1: One-sentence hook.
Line 2: Why it's gritty/edgy/fast and matches my vibe.
Line 3: Current streaming platform(s).

(Repeat exactly the same format for 2–10)

Never recommend anything older than the two-year window, never recommend anything not currently streaming, never add woke titles, never pad the list. If you can't find exactly 10+10 that fit every rule, say so at the very top and stop. Otherwise deliver exactly 20 items in the format above.

IMPORTANT: For each of the 20 items, you must include the direct poster image URL on the line immediately after the "Title (Year) — Country" line (use web search to find the real poster image URL). After the last movie, on a new line write exactly ---JSON--- and then a valid JSON object with two keys: "shows" and "movies". Each show/movie in those arrays must have: "title", "year", "country", "posterUrl" (the direct image URL string, or null if not found), "description" (the three description lines merged into one string), "streamingService" (e.g. Netflix, Prime Video). No other text after the JSON.`;

const CACHE_VERSION = 4;

export type ParseFailureReason = "no_json_marker" | "no_brace" | "json_parse_error" | "empty_shows";

function parseGrokResponse(raw: string): { shows: ShowItem[]; movies: ShowItem[] } | { error: ParseFailureReason } {
  const jsonMarker = "---JSON---";
  const idx = raw.indexOf(jsonMarker);
  if (idx === -1) return { error: "no_json_marker" };
  let jsonStr = raw.slice(idx + jsonMarker.length).replace(/^[\s\n]+/, "").trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace === -1) return { error: "no_brace" };
  let depth = 0;
  let end = firstBrace;
  for (let i = firstBrace; i < jsonStr.length; i++) {
    if (jsonStr[i] === "{") depth++;
    if (jsonStr[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const slice = jsonStr.slice(firstBrace, end);
  let obj: {
    shows?: Array<{ title?: string; year?: string; country?: string; posterUrl?: string | null; description?: string; streamingService?: string }>;
    movies?: Array<{ title?: string; year?: string; country?: string; posterUrl?: string | null; description?: string; streamingService?: string }>;
  };
  try {
    obj = JSON.parse(slice) as typeof obj;
  } catch {
    return { error: "json_parse_error" };
  }
  const toItem = (
    t: "show" | "movie",
    o: { title?: string; year?: string; country?: string; posterUrl?: string | null; description?: string; streamingService?: string }
  ): ShowItem => ({
    title: o.title ?? "",
    year: String(o.year ?? ""),
    type: t,
    description: o.description ?? "",
    genre: t === "movie" ? "Thriller" : "Drama",
    country: o.country ?? "USA",
    language: o.country === "USA" ? "English" : "Various",
    streamingService: o.streamingService ?? "",
    tmdbSearchTitle: o.title ?? "",
    trailerSearchQuery: `${o.title ?? ""} ${o.year ?? ""} Official Trailer`.trim(),
    mood: "gritty" as ShowMood,
    posterUrl: o.posterUrl && o.posterUrl.startsWith("http") ? o.posterUrl : null,
  });
  const shows: ShowItem[] = (obj.shows ?? []).map((o) => toItem("show", o));
  const movies: ShowItem[] = (obj.movies ?? []).map((o) => toItem("movie", o));
  if (shows.length === 0) return { error: "empty_shows" };
  return { shows, movies };
}

async function callGrokAndParse(apiKey: string): Promise<RecommendationsResult> {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: ARA_SYSTEM_PROMPT },
        { role: "user", content: "Generate my recommendations now. Use the current date to determine this year and last year. Output the 20 items in the format specified, then the ---JSON--- block with posterUrl for each." },
      ],
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Grok API error: ${res.status} — ${bodyText.slice(0, 200)}`);
  }

  let data: { output?: unknown[] };
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error(
      "Grok API returned invalid JSON (empty or truncated). Try again in a moment."
    );
  }

  type OutputItem = { type: string; content?: { type: string; text: string }[] };
  const messageItem = (data.output as OutputItem[] | undefined)?.find((o) => o.type === "message");
  const raw = messageItem?.content?.find((c) => c.type === "output_text")?.text ?? "";

  const parsed = parseGrokResponse(raw);
  if ("error" in parsed) {
    const reason = parsed.error;
    const snippet = raw.length > 800 ? raw.slice(-800) : raw;
    const msg =
      reason === "no_json_marker"
        ? "Grok did not include ---JSON--- block in response"
        : reason === "no_brace"
          ? "Grok's ---JSON--- block had no JSON object"
          : reason === "json_parse_error"
            ? "Grok's JSON after ---JSON--- failed to parse"
            : "Grok returned empty shows array";
    throw new Error(
      `Grok did not return valid structured data: ${msg}. Raw tail: ${snippet.replace(/\n/g, " ").slice(0, 400)}`
    );
  }

  return {
    shows: parsed.shows,
    movies: parsed.movies,
    cachedAt: Date.now(),
    version: CACHE_VERSION,
  };
}

/** Calls Grok and returns parsed recommendations. Retries once on structured-data parse failure. Throws on API or parse failure. */
export async function fetchRecommendationsFromGrok(apiKey: string): Promise<RecommendationsResult> {
  try {
    return await callGrokAndParse(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Grok did not return valid structured data") && message.includes("Raw tail:")) {
      console.warn("[shows-recommendations-grok] First attempt failed, retrying once...");
      return await callGrokAndParse(apiKey);
    }
    throw err;
  }
}
