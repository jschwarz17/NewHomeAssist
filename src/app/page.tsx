import Link from "next/link";
import { VoicePanel } from "@/components/VoicePanel";
import { FintechNewsWidget } from "@/components/dashboard/FintechNewsWidget";
import { IndieRockNewsWidget } from "@/components/dashboard/IndieRockNewsWidget";
import { StockPricesWidget } from "@/components/dashboard/StockPricesWidget";
import { GlamourCoverWidget } from "@/components/dashboard/GlamourCoverWidget";
import { HealthyBabyTipsWidget } from "@/components/dashboard/HealthyBabyTipsWidget";
import { ElegantShoesWidget } from "@/components/dashboard/ElegantShoesWidget";

export default function HomePage() {
  return (
    <main className="h-screen bg-black text-white font-sans px-6 pt-3 pb-2 flex flex-col overflow-hidden">
      {/* Title */}
      <h1 className="text-3xl font-extralight tracking-tight text-center mb-3">
        Casa de los Schwarzes
      </h1>

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

        {/* RIGHT: Quick nav + Voice */}
        <section className="flex flex-col min-h-0 gap-2">
          <Link
            href="/shows"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2.5 text-[11px] font-medium text-zinc-200 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors text-center block leading-tight"
          >
            🎬 Movies &amp; Shows
          </Link>
          <Link
            href="/artists"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2.5 text-[11px] font-medium text-zinc-200 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors text-center block leading-tight"
          >
            🎸 Artists
          </Link>
          <Link
            href="/substack"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2.5 text-[11px] font-medium text-zinc-200 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors text-center block leading-tight"
          >
            📰 Articles
          </Link>
          <VoicePanel />
        </section>
      </div>
    </main>
  );
}
