import { VoicePanel } from "@/components/VoicePanel";
import { FintechNewsWidget } from "@/components/dashboard/FintechNewsWidget";
import { IndieRockNewsWidget } from "@/components/dashboard/IndieRockNewsWidget";
import { StockPricesWidget } from "@/components/dashboard/StockPricesWidget";
import { GlamourCoverWidget } from "@/components/dashboard/GlamourCoverWidget";
import { HealthyBabyTipsWidget } from "@/components/dashboard/HealthyBabyTipsWidget";
import { ElegantShoesWidget } from "@/components/dashboard/ElegantShoesWidget";

export default function HomePage() {
  return (
    // MAIN CONTAINER: Pure black background, full-height, white text
    <main className="min-h-screen bg-black text-white font-sans p-6 md:p-10">
      {/* 1. HEADER AREA: Centered, prominent title */}
      <header className="relative text-center py-8 border-b border-zinc-900 mb-10">
        <h1 className="text-4xl md:text-5xl font-extralight tracking-tight">
          Casa de Schwarz
        </h1>
        <div className="absolute top-10 left-10 h-2 w-2 rounded-full bg-cyan-400 animate-pulse hidden md:block" />
      </header>

      {/* 2. THE DASHBOARD: Two columns — Jesse left, Vane right */}
      <div className="grid grid-cols-2 gap-x-12 relative min-h-[60vh]">
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-zinc-800" />

        {/* --- LEFT: Jesse's stuff --- */}
        <section className="col-span-1 pr-6 border-r border-transparent space-y-6">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-light text-zinc-300 tracking-wide uppercase mb-6">
              Jesse&apos;s stuff
            </h2>
          </div>
          <FintechNewsWidget />
          <IndieRockNewsWidget />
          <StockPricesWidget />
        </section>

        {/* --- RIGHT: Vane's stuff --- */}
        <section className="col-span-1 pl-6 space-y-6">
          <div className="text-center md:text-right">
            <h2 className="text-2xl font-light text-zinc-300 tracking-wide uppercase mb-6">
              Vane&apos;s stuff
            </h2>
          </div>
          <GlamourCoverWidget />
          <HealthyBabyTipsWidget />
          <ElegantShoesWidget />
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
