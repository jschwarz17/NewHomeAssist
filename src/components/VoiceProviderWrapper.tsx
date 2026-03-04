"use client";

import { useEffect } from "react";
import { VoiceProvider } from "@/context/VoiceProvider";
import { YouTubeProvider, useYouTube } from "@/context/YouTubeContext";
import { YouTubeOverlay } from "@/components/YouTubeOverlay";

function useSpotifyDeepLink() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appUrlOpen", ({ url }) => {
          if (!url.includes("spotify-callback")) return;
          try {
            const params = new URL(url).searchParams;
            const data = params.get("data");
            if (data) {
              const decoded = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
              const tokens = JSON.parse(decoded);
              if (tokens.access_token && tokens.refresh_token) {
                localStorage.setItem("spotify_tokens", JSON.stringify(tokens));
                console.log("[Spotify] Tokens saved via deep link");
              }
            }
          } catch (e) {
            console.error("[Spotify] Deep link parse error:", e);
          }
        });
        cleanup = () => listener.remove();
      } catch {
        // Not running in Capacitor (web dev mode) — ignore
      }
    })();

    return () => cleanup?.();
  }, []);
}

function VoiceProviderInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { playVideo, closeVideo } = useYouTube();
  useSpotifyDeepLink();

  const envUrl = process.env.NEXT_PUBLIC_ASSISTANT_API_URL;
  const apiBaseUrl = envUrl
    ? `${envUrl.replace(/\/+$/, "")}/api`
    : "/api";

  return (
    <VoiceProvider
      picovoiceAccessKey={process.env.NEXT_PUBLIC_PICOVOICE_API_KEY}
      apiBaseUrl={apiBaseUrl}
      onPlayYouTubeEmbed={playVideo}
      onCloseVideo={closeVideo}
    >
      {children}
      <YouTubeOverlay />
    </VoiceProvider>
  );
}

export function VoiceProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YouTubeProvider>
      <VoiceProviderInner>{children}</VoiceProviderInner>
    </YouTubeProvider>
  );
}
