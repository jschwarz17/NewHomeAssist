"use client";

import { useYouTube } from "@/context/YouTubeContext";
import { YouTubePlayer } from "@/components/YouTubePlayer";

export function YouTubeOverlay() {
  const { videoId, title, closeVideo } = useYouTube();

  if (!videoId) return null;

  return <YouTubePlayer videoId={videoId} title={title ?? undefined} onClose={closeVideo} />;
}
