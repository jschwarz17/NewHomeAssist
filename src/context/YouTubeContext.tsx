"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

interface YouTubeState {
  videoId: string | null;
  title: string | null;
}

interface YouTubeContextValue extends YouTubeState {
  playVideo: (videoId: string, title?: string) => void;
  closeVideo: () => void;
}

const YouTubeContext = createContext<YouTubeContextValue | null>(null);

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTube must be used within YouTubeProvider");
  return ctx;
}

export function YouTubeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<YouTubeState>({ videoId: null, title: null });

  const playVideo = useCallback((videoId: string, title?: string) => {
    setState({ videoId, title: title ?? null });
  }, []);

  const closeVideo = useCallback(() => {
    setState({ videoId: null, title: null });
  }, []);

  return (
    <YouTubeContext.Provider value={{ ...state, playVideo, closeVideo }}>
      {children}
    </YouTubeContext.Provider>
  );
}
