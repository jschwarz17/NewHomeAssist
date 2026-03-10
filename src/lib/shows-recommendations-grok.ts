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
  trailerVideoId: string | null;
  mood: ShowMood;
  posterUrl: string | null;
}

export interface RecommendationsResult {
  shows: ShowItem[];
  movies: ShowItem[];
  cachedAt: number;
  version: number;
}

const ARA_SYSTEM_PROMPT = `You are Ara, curating TV and movie recommendations for a user who likes gritty thrillers, sharp dark comedies, and fast-paced prestige streaming releases.

Return ONLY one valid JSON object and nothing else. Do not use markdown fences.

Use the actual current date right now to determine the allowed release window. Every recommendation must satisfy all of these rules:
1. It was released in the current calendar year or previous calendar year only.
2. It is already available to stream right now on a major streaming platform.
3. It fits the user's taste for gritty, intense, sharp, or darkly funny storytelling.
4. Prefer a mix of U.S. and international titles.
5. Aim for exactly 10 shows and 10 movies.

Return this exact JSON shape:
{
  "shows": [
    {
      "title": "string",
      "year": "2026",
      "country": "string",
      "posterUrl": "https://..." or null,
      "description": "2 concise sentences merged into one paragraph.",
      "streamingService": "Netflix",
      "genre": "string",
      "language": "string",
      "mood": "fun|gritty|quirky|funny|suspenseful"
    }
  ],
  "movies": [
    {
      "title": "string",
      "year": "2026",
      "country": "string",
      "posterUrl": "https://..." or null,
      "description": "2 concise sentences merged into one paragraph.",
      "streamingService": "Netflix",
      "genre": "string",
      "language": "string",
      "mood": "fun|gritty|quirky|funny|suspenseful"
    }
  ]
}`;

const CACHE_VERSION = 4;

export type ParseFailureReason = "no_brace" | "json_parse_error" | "empty_shows";

function parseGrokResponse(raw: string): { shows: ShowItem[]; movies: ShowItem[] } | { error: ParseFailureReason } {
  let jsonStr = raw.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace === -1) return { error: "no_brace" };
  
  // Try to find the complete JSON object by tracking braces
  let depth = 0;
  let end = firstBrace;
  let inString = false;
  let escapeNext = false;
  
  for (let i = firstBrace; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === "{") depth++;
      if (char === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
  }
  
  // If we didn't find a complete object, try to extract what we can
  if (depth !== 0) {
    // Try to find the last complete closing brace
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      // Verify this might be a valid end
      const potentialSlice = jsonStr.slice(firstBrace, lastBrace + 1);
      try {
        const test = JSON.parse(potentialSlice);
        if (test && (test.shows || test.movies)) {
          end = lastBrace + 1;
        }
      } catch {
        // Ignore, will try other methods
      }
    }
  }
  
  let slice = jsonStr.slice(firstBrace, end);
  
  // Try to fix common JSON issues
  // Remove trailing commas before closing braces/brackets
  slice = slice.replace(/,(\s*[}\]])/g, "$1");
  
  // Try to close incomplete JSON if needed
  if (depth > 0) {
    // Add missing closing braces
    slice += "}".repeat(depth);
  }
  
  let obj: {
    shows?: Array<{
      title?: string;
      year?: string;
      country?: string;
      posterUrl?: string | null;
      description?: string;
      streamingService?: string;
      genre?: string;
      language?: string;
      mood?: ShowMood;
    }>;
    movies?: Array<{
      title?: string;
      year?: string;
      country?: string;
      posterUrl?: string | null;
      description?: string;
      streamingService?: string;
      genre?: string;
      language?: string;
      mood?: ShowMood;
    }>;
  };
  try {
    obj = JSON.parse(slice) as typeof obj;
  } catch (parseError) {
    // Try one more time with a more aggressive cleanup
    slice = slice.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try {
      obj = JSON.parse(slice) as typeof obj;
    } catch {
      console.error("[shows-recommendations-grok] JSON parse error:", parseError);
      console.error("[shows-recommendations-grok] Attempted to parse:", slice.slice(0, 500));
      return { error: "json_parse_error" };
    }
  }
  const toItem = (
    t: "show" | "movie",
    o: {
      title?: string;
      year?: string;
      country?: string;
      posterUrl?: string | null;
      description?: string;
      streamingService?: string;
      genre?: string;
      language?: string;
      mood?: ShowMood;
    }
  ): ShowItem => ({
    title: o.title ?? "",
    year: String(o.year ?? ""),
    type: t,
    description: o.description ?? "",
    genre: o.genre ?? (t === "movie" ? "Thriller" : "Drama"),
    country: o.country ?? "USA",
    language: o.language ?? (o.country === "USA" ? "English" : "Various"),
    streamingService: o.streamingService ?? "",
    tmdbSearchTitle: o.title ?? "",
    trailerSearchQuery: `${o.title ?? ""} ${o.year ?? ""} Official Trailer`.trim(),
    trailerVideoId: null,
    mood: o.mood ?? ("gritty" as ShowMood),
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
        {
          role: "user",
          content:
            "Generate the recommendations now. Return JSON only with 10 shows and 10 movies if possible, using the current calendar year and previous calendar year window.",
        },
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
  const contentBlocks = messageItem?.content ?? [];
  const outputTextBlocks = contentBlocks.filter((c): c is { type: string; text: string } => c.type === "output_text");
  // Join all output_text blocks in case the response is split across multiple blocks
  const raw = outputTextBlocks.map((b) => b.text).join("\n");

  const parsed = parseGrokResponse(raw);
  if ("error" in parsed) {
    const reason = parsed.error;
    const snippet = raw.length > 800 ? raw.slice(-800) : raw;
    const msg =
      reason === "no_brace"
        ? "Grok's response had no JSON object"
        : reason === "json_parse_error"
          ? "Grok's JSON response failed to parse"
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
