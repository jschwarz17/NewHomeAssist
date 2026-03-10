"use client";

import Image from "next/image";
import React from "react";
import type { ArtistSectionItem } from "@/context/ArtistsContext";
import { openLink } from "@/lib/open-link";

export interface ArtistCardProps extends ArtistSectionItem {
  isSelected: boolean;
  onSelect: () => void;
}

export function ArtistCard({
  name,
  description,
  genre,
  spotifyId,
  spotifyTrackUri,
  imageUrl,
  isSelected,
  onSelect,
}: ArtistCardProps) {
  const [imgError, setImgError] = React.useState(false);
  const [resolvedImage, setResolvedImage] = React.useState<string | null>(imageUrl ?? null);

  React.useEffect(() => {
    setImgError(false);
    setResolvedImage(imageUrl ?? null);
  }, [imageUrl]);

  // Hydrate image when missing: fetch from artist image API
  React.useEffect(() => {
    if (resolvedImage || !name?.trim()) return;
    const base = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "") : "";
    const url = base ? `${base}/api/artists/image/` : "/api/artists/image/";
    fetch(`${url}?name=${encodeURIComponent(name.trim())}`)
      .then((r) => r.json())
      .then((data: { image?: string | null }) => {
        if (data.image && data.image.startsWith("http")) {
          setResolvedImage(data.image);
        }
      })
      .catch(() => {});
  }, [resolvedImage, name]);

  // Spotify widget: use existing data or fetch from API when missing
  const [spotifyData, setSpotifyData] = React.useState<{
    spotifyId: string | null;
    spotifyTrackUri: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (spotifyId || spotifyTrackUri) {
      setSpotifyData({ spotifyId, spotifyTrackUri });
      return;
    }
    if (!name?.trim()) return;
    const base = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "").replace(/\/$/, "") : "";
    const url = base ? `${base}/api/artists/spotify/` : "/api/artists/spotify/";
    fetch(`${url}?name=${encodeURIComponent(name.trim())}`)
      .then((r) => r.json())
      .then((data: { spotifyId?: string | null; spotifyTrackUri?: string | null }) => {
        if (data.spotifyId || data.spotifyTrackUri) {
          setSpotifyData({
            spotifyId: data.spotifyId ?? null,
            spotifyTrackUri: data.spotifyTrackUri ?? null,
          });
        }
      })
      .catch(() => {});
  }, [spotifyId, spotifyTrackUri, name]);

  const effectiveSpotifyId = spotifyData?.spotifyId ?? spotifyId;
  const effectiveSpotifyTrackUri = spotifyData?.spotifyTrackUri ?? spotifyTrackUri;
  const spotifyTrackId = effectiveSpotifyTrackUri?.replace("spotify:track:", "") ?? null;
  const spotifyArtistId = effectiveSpotifyId?.replace("spotify:artist:", "") ?? null;
  const hasSpotifyWidget = spotifyTrackId || spotifyArtistId;
  const spotifyTrackUrl = spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : null;
  const spotifyArtistUrl = spotifyArtistId ? `https://open.spotify.com/artist/${spotifyArtistId}` : null;

  return (
    <div
      className={`rounded-xl border bg-zinc-950 transition-colors cursor-pointer ${
        isSelected ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700"
      }`}
      onClick={onSelect}
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="flex-shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden bg-zinc-800">
          {(resolvedImage || imageUrl) && !imgError ? (
            <Image
              src={resolvedImage || imageUrl || ""}
              alt={name}
              width={72}
              height={72}
              className="object-cover w-full h-full"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-zinc-600 text-2xl">🎸</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2">
            {name}
          </h3>

          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {genre}
            </span>
          </div>

          <p className={`text-zinc-400 text-xs mt-1.5 leading-relaxed ${isSelected ? "" : "line-clamp-2"}`}>
            {description}
          </p>
        </div>
      </div>

      {/* Spotify widget: below each artist so user can play a song */}
      {hasSpotifyWidget && (
        <div
          className="px-3 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-t border-zinc-800 pt-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {spotifyTrackUrl && (
                <button
                  type="button"
                  onClick={() => {
                    void openLink(spotifyTrackUrl);
                  }}
                  className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                >
                  Open track
                </button>
              )}
              {spotifyArtistUrl && (
                <button
                  type="button"
                  onClick={() => {
                    void openLink(spotifyArtistUrl);
                  }}
                  className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                >
                  Open artist
                </button>
              )}
            </div>
            <iframe
              src={
                spotifyTrackId
                  ? `https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`
                  : `https://open.spotify.com/embed/artist/${spotifyArtistId}?utm_source=generator&theme=0`
              }
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
              style={{ minHeight: "152px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
