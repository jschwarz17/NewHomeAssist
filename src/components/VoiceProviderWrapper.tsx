"use client";

import { VoiceProvider } from "@/context/VoiceProvider";
import { YouTubeProvider, useYouTube } from "@/context/YouTubeContext";
import { YouTubeOverlay } from "@/components/YouTubeOverlay";

function VoiceProviderInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { playVideo, closeVideo } = useYouTube();

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
