import { VoicePanel } from "@/components/VoicePanel";
import { FintechNewsWidget } from "@/components/dashboard/FintechNewsWidget";
import { IndieRockNewsWidget } from "@/components/dashboard/IndieRockNewsWidget";
import { StockPricesWidget } from "@/components/dashboard/StockPricesWidget";
import { GlamourCoverWidget } from "@/components/dashboard/GlamourCoverWidget";
import { HealthyBabyTipsWidget } from "@/components/dashboard/HealthyBabyTipsWidget";
import { ElegantShoesWidget } from "@/components/dashboard/ElegantShoesWidget";
import { SonosButton } from "@/components/SonosButton";

export default function HomePage() {
  return (
    <main className="h-screen bg-black text-white font-sans px-6 pt-3 pb-2 flex flex-col overflow-hidden">
      {/* Title row */}
      <div className="flex items-center justify-center mb-3 relative">
        <h1 className="text-3xl font-extralight tracking-tight text-center">
          Casa de los Schwarzes
        </h1>
        <div className="absolute right-0">
          <SonosButton />
        </div>
      </div>

      {/* Dashboard grid: 3 columns — Jesse | Vane | Voice */}
      <div className="flex-1 grid grid-cols-[1fr_1fr_140px] gap-x-6 min-h-0">
        {/* LEFT: Jesse */}
        <section className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-3 border-r border-zinc-800">
          <h2 className="text-sm font-light text-zinc-400 tracking-wide uppercase">
            Jesse&apos;s stuff
          </h2>
          <FintechNewsWidget />
          <IndieRockNewsWidget />
          <StockPricesWidget />
        </section>

        {/* CENTER: Vane */}
        <section className="flex flex-col gap-3 min-h-0 overflow-y-auto px-3 border-r border-zinc-800">
          <h2 className="text-sm font-light text-zinc-400 tracking-wide uppercase">
            Vane&apos;s stuff
          </h2>
          <GlamourCoverWidget />
          <HealthyBabyTipsWidget />
          <ElegantShoesWidget />
        </section>

        {/* RIGHT: Voice */}
        <section className="flex flex-col min-h-0">
          <VoicePanel />
        </section>
      </div>
    </main>
  );
}
