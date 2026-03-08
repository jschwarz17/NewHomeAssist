"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
}

export interface ShowsSectionItem extends ShowItem {
  id: string;
  posterUrl: string | null;
}

interface ShowsState {
  shows: ShowsSectionItem[];
  movies: ShowsSectionItem[];
  loading: boolean;
  error: string | null;
}

interface ShowsContextValue extends ShowsState {
  refresh: () => void;
}

interface LocalCacheEntry {
  shows: ShowsSectionItem[];
  movies: ShowsSectionItem[];
  cachedAt: number;
}

const CACHE_KEY = "shows_cache_v3";
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
    posterUrl: null,
  };
}

function readLocalCache(): LocalCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: LocalCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt < CACHE_TTL_MS) return entry;
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
  });

  const fetchPosters = useCallback(
    (
      items: ShowsSectionItem[],
      setter: React.Dispatch<React.SetStateAction<ShowsState>>,
      key: "shows" | "movies",
      base: string
    ) => {
      items.forEach((item) => {
        const searchTitle = item.tmdbSearchTitle || item.title;
        const yearParam = item.year ? `&year=${encodeURIComponent(item.year)}` : "";
        const url = base
          ? `${base}/api/shows/poster/?query=${encodeURIComponent(searchTitle)}&type=${item.type}${yearParam}`
          : `/api/shows/poster?query=${encodeURIComponent(searchTitle)}&type=${item.type}${yearParam}`;

        fetch(url)
          .then((r) => (r.ok ? r.json() : { poster: null }))
          .then((data: { poster: string | null }) => {
            // #region agent log
            fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d3f76'},body:JSON.stringify({sessionId:'8d3f76',location:'ShowsContext:poster-result',message:'Poster API response',data:{title:item.title,searchTitle,posterFound:!!data.poster,urlDomain:data.poster?new URL(data.poster).hostname:null,url:data.poster},timestamp:Date.now(),hypothesisId:'H-H'})}).catch(()=>{});
            // #endregion
            if (!data.poster) return;
            setter((prev) => {
              const updated = prev[key].map((p) =>
                p.id === item.id ? { ...p, posterUrl: data.poster } : p
              );
              const next = { ...prev, [key]: updated };
              // Update localStorage with poster as it arrives
              writeLocalCache({
                shows: next.shows,
                movies: next.movies,
                cachedAt: Date.now(),
              });
              return next;
            });
          })
          .catch(() => {});
      });
    },
    []
  );

  const fetchData = useCallback(
    (force = false) => {
      // Check localStorage first (unless forced)
      if (!force) {
        const cached = readLocalCache();
        if (cached) {
          // #region agent log
          const sampleUrls = [...cached.shows, ...cached.movies].slice(0, 5).map(i => ({ title: i.title, posterUrl: i.posterUrl }));
          fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d3f76'},body:JSON.stringify({sessionId:'8d3f76',location:'ShowsContext:cache-hit',message:'Serving from localStorage cache',data:{cachedAt:new Date(cached.cachedAt).toISOString(),showCount:cached.shows.length,movieCount:cached.movies.length,sampleUrls},timestamp:Date.now(),hypothesisId:'H-G'})}).catch(()=>{});
          // #endregion
          setState({
            shows: cached.shows,
            movies: cached.movies,
            loading: false,
            error: null,
          });
          return;
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7941/ingest/682557f1-4c11-46b8-bba1-57fb1f47de33',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d3f76'},body:JSON.stringify({sessionId:'8d3f76',location:'ShowsContext:cache-miss',message:'No valid cache - fetching fresh from API',data:{force},timestamp:Date.now(),hypothesisId:'H-G'})}).catch(()=>{});
      // #endregion

      setState((prev) => ({ ...prev, loading: true, error: null }));

      const base = getApiBase();
      const url = base
        ? `${base}/api/shows/recommendations/`
        : "/api/shows/recommendations";

      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
        .then((data: { shows: ShowItem[]; movies: ShowItem[] }) => {
          const showItems = (data.shows ?? []).map((s, i) =>
            toSectionItem(s, i)
          );
          const movieItems = (data.movies ?? []).map((m, i) =>
            toSectionItem(m, i)
          );

          const cacheEntry: LocalCacheEntry = {
            shows: showItems,
            movies: movieItems,
            cachedAt: Date.now(),
          };
          writeLocalCache(cacheEntry);

          setState({ shows: showItems, movies: movieItems, loading: false, error: null });

          // Kick off poster fetches in background
          fetchPosters(showItems, setState, "shows", base);
          fetchPosters(movieItems, setState, "movies", base);
        })
        .catch((e) => {
          console.error("[shows] recommendations error:", e);
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Couldn't load recommendations. Please try again.",
          }));
        });
    },
    [fetchPosters]
  );

  // Kick off fetch immediately when provider mounts (app start)
  useEffect(() => {
    fetchData();
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
