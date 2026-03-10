"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CURATED_MOVIES, CURATED_SHOWS } from "@/lib/curated-shows";

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

export interface ShowsSectionItem extends ShowItem {
  id: string;
}

interface ShowsState {
  shows: ShowsSectionItem[];
  movies: ShowsSectionItem[];
  loading: boolean;
  error: string | null;
  notice: string | null;
}

interface ShowsContextValue extends ShowsState {
  refresh: () => void;
}

interface LocalCacheEntry {
  shows: ShowsSectionItem[];
  movies: ShowsSectionItem[];
  cachedAt: number;
  notice: string | null;
}

const CACHE_KEY = "shows_cache_v8";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ShowsContext = createContext<ShowsContextValue | null>(null);

export function useShows() {
  const ctx = useContext(ShowsContext);
  if (!ctx) throw new Error("useShows must be used within ShowsProvider");
  return ctx;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

function toSectionItem(item: ShowItem, index: number): ShowsSectionItem {
  return {
    ...item,
    id: `${item.type}-${index}`,
    posterUrl: item.posterUrl ?? null,
    trailerVideoId: item.trailerVideoId ?? null,
  };
}

function isUsableShowItem(item: unknown): item is ShowItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<ShowItem>;
  return Boolean(
    candidate.title?.trim() &&
      candidate.year?.trim() &&
      candidate.description?.trim() &&
      candidate.genre?.trim() &&
      candidate.streamingService?.trim()
  );
}

function getFallbackShows(): Pick<ShowsState, "shows" | "movies"> {
  return {
    shows: CURATED_SHOWS.map((show, index) => toSectionItem(show, index)),
    movies: CURATED_MOVIES.map((movie, index) => toSectionItem(movie, index)),
  };
}

function readLocalCache(): LocalCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: LocalCacheEntry = JSON.parse(raw);
    if (
      Date.now() - entry.cachedAt < CACHE_TTL_MS &&
      Array.isArray(entry.shows) &&
      entry.shows.every(isUsableShowItem) &&
      Array.isArray(entry.movies) &&
      entry.movies.every(isUsableShowItem)
    ) {
      return entry;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function writeLocalCache(entry: LocalCacheEntry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // storage might be full — ignore
  }
}

export function ShowsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShowsState>({
    shows: [],
    movies: [],
    loading: true,
    error: null,
    notice: null,
  });

  const fetchData = useCallback((force = false) => {
    if (!force) {
      const cached = readLocalCache();
      if (cached) {
        setState({
          shows: cached.shows,
          movies: cached.movies,
          loading: false,
          error: null,
          notice: cached.notice ?? null,
        });
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null, notice: prev.notice ?? null }));

    const base = getApiBase();
    const url = base
      ? `${base}/api/shows/recommendations/`
      : "/api/shows/recommendations";

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then(
              (body: { error?: string }) => Promise.reject(body?.error ?? r.statusText),
              () => Promise.reject(r.statusText)
            )
      )
      .then((data: { shows: ShowItem[]; movies: ShowItem[]; notice?: string | null }) => {
        clearTimeout(timeoutId);
        const sourceShows =
          Array.isArray(data.shows) && data.shows.every(isUsableShowItem)
            ? data.shows
            : CURATED_SHOWS;
        const sourceMovies =
          Array.isArray(data.movies) && data.movies.every(isUsableShowItem)
            ? data.movies
            : CURATED_MOVIES;
        const showItems = sourceShows.map((s, i) => toSectionItem(s, i));
        const movieItems = sourceMovies.map((m, i) => toSectionItem(m, i));

        const cacheEntry: LocalCacheEntry = {
          shows: showItems,
          movies: movieItems,
          cachedAt: Date.now(),
          notice: data.notice ?? null,
        };
        writeLocalCache(cacheEntry);

        setState({
          shows: showItems,
          movies: movieItems,
          loading: false,
          error: null,
          notice: data.notice ?? null,
        });
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        console.error("[shows] recommendations error:", e);
        const fallback = getFallbackShows();
        setState({
          ...fallback,
          loading: false,
          error: null,
          notice: null,
        });
      });
  }, []);

  // Kick off fetch immediately when provider mounts (app start)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const refresh = useCallback(() => {
    // Clear cache and re-fetch
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    fetchData(true);
  }, [fetchData]);

  return (
    <ShowsContext.Provider value={{ ...state, refresh }}>
      {children}
    </ShowsContext.Provider>
  );
}
