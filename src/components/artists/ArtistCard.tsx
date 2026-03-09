"use client";

import Image from "next/image";
import React from "react";
import type { ArtistSectionItem } from "@/context/ArtistsContext";

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
  React.useEffect(() => { setImgError(false); }, [imageUrl]);

  // Extract Spotify track ID from URI for embed
  const spotifyTrackId = spotifyTrackUri?.replace("spotify:track:", "") ?? null;

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
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
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

      {/* Expanded: Spotify widget */}
      {isSelected && spotifyTrackId && (
        <div
          className="px-3 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-t border-zinc-800 pt-3">
            <iframe
              src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
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
