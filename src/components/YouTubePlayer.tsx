"use client";

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  onClose: () => void;
}

export function YouTubePlayer({ videoId, title, onClose }: YouTubePlayerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="w-full max-w-5xl px-6">
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h3 className="text-sm text-zinc-400 truncate mr-4">{title}</h3>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Close
          </button>
        </div>
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title ?? "YouTube video"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full rounded-lg"
          />
        </div>
        <p className="mt-3 text-center text-xs text-zinc-600">
          Say &quot;dashboard&quot; or &quot;done&quot; to go back
        </p>
      </div>
    </div>
  );
}
