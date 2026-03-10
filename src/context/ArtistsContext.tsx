"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ArtistItem {
  name: string;
  description: string;
  genre: string;
  spotifyId: string | null;
  spotifyTrackUri: string | null;
  imageUrl: string | null;
}

export interface ArtistSectionItem extends ArtistItem {
  id: string;
}

interface ArtistsState {
  artists: ArtistSectionItem[];
  loading: boolean;
  error: string | null;
}

interface ArtistsContextValue extends ArtistsState {
  refresh: () => void;
}

interface LocalCacheEntry {
  artists: ArtistSectionItem[];
  cachedAt: number;
}

const CACHE_KEY = "artists_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ArtistsContext = createContext<ArtistsContextValue | null>(null);

export function useArtists() {
  const ctx = useContext(ArtistsContext);
  if (!ctx) throw new Error("useArtists must be used within ArtistsProvider");
  return ctx;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

function toSectionItem(item: ArtistItem, index: number): ArtistSectionItem {
  return {
    ...item,
    id: `artist-${index}`,
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

export function ArtistsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ArtistsState>({
    artists: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback((force = false) => {
    if (!force) {
      const cached = readLocalCache();
      if (cached) {
        setState({
          artists: cached.artists,
          loading: false,
          error: null,
        });
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const base = getApiBase();
    const url = base
      ? `${base}/api/artists/recommendations/`
      : "/api/artists/recommendations";

    // Timeout: allow up to 120 s for on-demand Grok calls (first load without cache)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then(
              (body: { error?: string }) => Promise.reject(body?.error ?? r.statusText),
              () => Promise.reject(r.statusText)
            )
      )
      .then((data: { artists: ArtistItem[] }) => {
        clearTimeout(timeoutId);
        const artistItems = (data.artists ?? []).map((a, i) => toSectionItem(a, i));

        const cacheEntry: LocalCacheEntry = {
          artists: artistItems,
          cachedAt: Date.now(),
        };
        writeLocalCache(cacheEntry);

        setState({
          artists: artistItems,
          loading: false,
          error: null,
        });
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        console.error("[artists] recommendations error:", e);
        const errorMessage = e.name === "AbortError" 
          ? "Request timed out. Please try again."
          : typeof e === "string" 
            ? e 
            : "Couldn't load artists. Please try again.";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      });
  }, []);

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
    <ArtistsContext.Provider value={{ ...state, refresh }}>
      {children}
    </ArtistsContext.Provider>
  );
}
