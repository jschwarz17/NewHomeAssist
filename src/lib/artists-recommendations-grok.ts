/**
 * Single Grok API call for indie rock artist recommendations.
 */

export interface ArtistItem {
  name: string;
  description: string;
  genre: string;
  spotifyId: string | null;
  spotifyTrackUri: string | null;
  imageUrl: string | null;
  breakoutYear: string | null;
  tractionSummary: string | null;
}

export interface ArtistsResult {
  artists: ArtistItem[];
  cachedAt: number;
  version: number;
}

const ARTISTS_SYSTEM_PROMPT = `You are Grok, curating new indie rock artists for a user who likes textured, adventurous guitar music in the spirit of Radiohead, Foals, and Queens of the Stone Age.

Return ONLY one valid JSON object and nothing else. Do not use markdown fences.

Every recommendation must satisfy all of these rules:
1. The artist is genuinely new or newly breaking out, not a legacy act.
2. The artist gained meaningful traction on Spotify in the current calendar year or previous calendar year only. Use the real current date right now to determine the two-year window.
3. The artist fits indie rock, art rock, post-punk, shoegaze, or adjacent guitar-driven scenes.
4. Do NOT include long-established artists or bands that have been prominent for many years.
5. Aim for exactly 10 artists.

Return this exact JSON shape:
{
  "artists": [
    {
      "name": "string",
      "description": "2 concise sentences about the sound and why the artist fits.",
      "genre": "comma-separated genres",
      "spotifyId": null,
      "spotifyTrackUri": null,
      "imageUrl": null,
      "breakoutYear": "2026",
      "tractionSummary": "1 short sentence explaining the recent Spotify momentum."
    }
  ]
}`;

const CACHE_VERSION = 2;
const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export type ParseFailureReason = "no_brace" | "json_parse_error" | "empty_artists";

function parseGrokResponse(raw: string): { artists: ArtistItem[] } | { error: ParseFailureReason } {
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
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      const potentialSlice = jsonStr.slice(firstBrace, lastBrace + 1);
      try {
        const test = JSON.parse(potentialSlice);
        if (test && test.artists) {
          end = lastBrace + 1;
        }
      } catch {
        // Ignore
      }
    }
  }
  
  let slice = jsonStr.slice(firstBrace, end);
  
  // Try to fix common JSON issues
  slice = slice.replace(/,(\s*[}\]])/g, "$1");
  
  if (depth > 0) {
    slice += "}".repeat(depth);
  }
  
  let obj: {
    artists?: Array<{
      name?: string;
      description?: string;
      genre?: string;
      spotifyId?: string | null;
      spotifyTrackUri?: string | null;
      imageUrl?: string | null;
      breakoutYear?: string | null;
      tractionSummary?: string | null;
    }>;
  };
  try {
    obj = JSON.parse(slice) as typeof obj;
  } catch (parseError) {
    slice = slice.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try {
      obj = JSON.parse(slice) as typeof obj;
    } catch {
      console.error("[artists-recommendations-grok] JSON parse error:", parseError);
      console.error("[artists-recommendations-grok] Attempted to parse:", slice.slice(0, 500));
      return { error: "json_parse_error" };
    }
  }
  const toItem = (
    o: {
      name?: string;
      description?: string;
      genre?: string;
      spotifyId?: string | null;
      spotifyTrackUri?: string | null;
      imageUrl?: string | null;
      breakoutYear?: string | null;
      tractionSummary?: string | null;
    }
  ): ArtistItem => ({
    name: o.name ?? "",
    description: o.description ?? "",
    genre: o.genre ?? "indie rock",
    spotifyId: o.spotifyId && o.spotifyId.startsWith("spotify:artist:") ? o.spotifyId : null,
    spotifyTrackUri: o.spotifyTrackUri && o.spotifyTrackUri.startsWith("spotify:track:") ? o.spotifyTrackUri : null,
    imageUrl: o.imageUrl && o.imageUrl.startsWith("http") ? o.imageUrl : null,
    breakoutYear: o.breakoutYear ?? null,
    tractionSummary: o.tractionSummary ?? null,
  });
  const artists: ArtistItem[] = (obj.artists ?? []).map((o) => toItem(o));
  if (artists.length === 0) return { error: "empty_artists" };
  return { artists };
}

const REQUEST_TIMEOUT_MS = 20000;

async function callGrokAndParse(apiKey: string): Promise<ArtistsResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.GROK_MODEL ?? "grok-3-mini",
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          { role: "system", content: ARTISTS_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Generate the artist recommendations now. Use your built-in knowledge only. Return JSON only with 10 new indie rock artists whose Spotify breakout happened in the current or previous calendar year.",
          },
        ],
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Grok API error: ${res.status} — ${bodyText.slice(0, 200)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error(
      "Grok API returned invalid JSON (empty or truncated). Try again in a moment."
    );
  }

  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  const parsed = parseGrokResponse(raw);
  if ("error" in parsed) {
    const reason = parsed.error;
    const snippet = raw.length > 800 ? raw.slice(-800) : raw;
    const msg =
      reason === "no_brace"
        ? "Grok's response had no JSON object"
        : reason === "json_parse_error"
          ? "Grok's JSON response failed to parse"
          : "Grok returned empty artists array";
    throw new Error(
      `Grok did not return valid structured data: ${msg}. Raw tail: ${snippet.replace(/\n/g, " ").slice(0, 400)}`
    );
  }

  return {
    artists: parsed.artists,
    cachedAt: Date.now(),
    version: CACHE_VERSION,
  };
}

/** Calls Grok and returns parsed recommendations. Retries once on structured-data parse failure. Throws on API or parse failure. */
export async function fetchArtistsFromGrok(apiKey: string): Promise<ArtistsResult> {
  try {
    return await callGrokAndParse(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Grok artists request timed out");
    }
    if (message.includes("Grok did not return valid structured data") && message.includes("Raw tail:")) {
      console.warn("[artists-recommendations-grok] First attempt failed, retrying once...");
      return await callGrokAndParse(apiKey);
    }
    throw err;
  }
}
