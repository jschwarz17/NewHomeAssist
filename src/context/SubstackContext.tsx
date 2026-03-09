"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface SubstackArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category: "AI" | "Politics" | "Fintech";
}

interface SubstackState {
  ai: SubstackArticle[];
  politics: SubstackArticle[];
  fintech: SubstackArticle[];
  loading: boolean;
  error: string | null;
}

interface SubstackContextValue extends SubstackState {
  refresh: () => void;
}

const SubstackContext = createContext<SubstackContextValue | null>(null);

export function useSubstack() {
  const ctx = useContext(SubstackContext);
  if (!ctx) throw new Error("useSubstack must be used within SubstackProvider");
  return ctx;
}

function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "");
}

export function SubstackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubstackState>({
    ai: [],
    politics: [],
    fintech: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback((force = false) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const base = getApiBase();
    const url = base
      ? `${base}/api/substack/articles/`
      : "/api/substack/articles";

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then(
              (body: { error?: string }) => Promise.reject(body?.error ?? r.statusText),
              () => Promise.reject(r.statusText)
            )
      )
      .then((data: { ai: SubstackArticle[]; politics: SubstackArticle[]; fintech: SubstackArticle[] }) => {
        clearTimeout(timeoutId);
        setState({
          ai: data.ai ?? [],
          politics: data.politics ?? [],
          fintech: data.fintech ?? [],
          loading: false,
          error: null,
        });
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        console.error("[substack] articles error:", e);
        const errorMessage = e.name === "AbortError" 
          ? "Request timed out. Please try again."
          : typeof e === "string" 
            ? e 
            : "Couldn't load articles. Please try again.";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      });
  }, []);

  // Kick off fetch immediately when provider mounts
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return (
    <SubstackContext.Provider value={{ ...state, refresh }}>
      {children}
    </SubstackContext.Provider>
  );
}
