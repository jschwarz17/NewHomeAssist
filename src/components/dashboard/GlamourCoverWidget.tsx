"use client";

export function GlamourCoverWidget() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 px-4 pt-4 pb-2">
        Glamour
      </h3>
      <a
        href="https://www.glamour.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="block p-2"
      >
        <img
          src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=280&h=360&fit=crop"
          alt="Glamour magazine cover"
          className="w-28 h-auto mx-auto rounded object-cover"
        />
      </a>
    </div>
  );
}
