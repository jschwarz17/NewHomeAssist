import { VoicePanel } from "@/components/VoicePanel";

export default function HomePage() {
  return (
    // MAIN CONTAINER: Pure black background, full-height, white text
    <main className="min-h-screen bg-black text-white font-sans p-6 md:p-10">
      {/* 1. HEADER AREA: Centered, prominent title */}
      <header className="relative text-center py-8 border-b border-zinc-900 mb-10">
        <h1 className="text-4xl md:text-5xl font-extralight tracking-tight">
          Casa de Schwarz
        </h1>
        {/* Subtle, pulsing cyan dot—matches the 'fintech' vibe */}
        <div className="absolute top-10 left-10 h-2 w-2 rounded-full bg-cyan-400 animate-pulse hidden md:block" />
      </header>

      {/* 2. THE DASHBOARD: A grid with two equal columns */}
      <div className="grid grid-cols-2 gap-x-12 relative min-h-[60vh]">
        {/* THE VERTICAL DIVIDER LINE */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-zinc-800" />

        {/* --- LEFT COLUMN: Jesse's Stuff --- */}
        <section className="col-span-1 pr-6 border-r border-transparent">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-light text-zinc-300 tracking-wide uppercase mb-12">
              Jesse&apos;s stuff
            </h2>
          </div>

          {/* Placeholder Content: We will integrate Picovoice here later */}
          <div className="space-y-6 opacity-60">
            <p className="font-mono text-zinc-500">
              // Voice profiles loading... (Status:)
            </p>
            <div className="h-24 rounded-lg bg-zinc-950 border border-zinc-900"></div>
          </div>
        </section>

        {/* --- RIGHT COLUMN: Vane's Stuff --- */}
        <section className="col-span-1 pl-6">
          <div className="text-center md:text-right">
            <h2 className="text-2xl font-light text-zinc-300 tracking-wide uppercase mb-12">
              Vane&apos;s stuff
            </h2>
          </div>

          {/* Placeholder Content: We will integrate Vane's calendar/music here */}
          <div className="space-y-6 opacity-60">
            <p className="font-mono text-zinc-500">
              // Speaker ID inactive. (Enroll Vanessa&apos;s Profile)
            </p>
            <div className="h-24 rounded-lg bg-zinc-950 border border-zinc-900"></div>
          </div>
        </section>
      </div>

      {/* Voice: start listening, then say "Hi Ara" or "Porcupine" */}
      <section className="mt-8 max-w-xl">
        <VoicePanel />
      </section>

      {/* FOOTER AREA (For Voice Feedback) */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-zinc-900 mt-10">
        <div className="w-full h-8 rounded-full bg-zinc-950 border border-zinc-900 flex items-center px-4 font-mono text-xs text-zinc-600">
          CasaDeSchwarz.local :: ::...
        </div>
      </footer>
    </main>
  );
}
