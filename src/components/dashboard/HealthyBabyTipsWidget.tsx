"use client";

const TIPS = [
  "Keep a consistent sleep routine for better baby rest.",
  "Offer a variety of textures when starting solids.",
  "Talk and read to your baby daily to support language.",
  "Support tummy time when baby is awake and supervised.",
];

export function HealthyBabyTipsWidget() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
        Tips for a healthy baby
      </h3>
      <ul className="space-y-2">
        {TIPS.map((tip, i) => (
          <li key={i} className="text-sm text-zinc-300">
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
