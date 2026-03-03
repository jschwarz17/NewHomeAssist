import { VoicePanel } from "@/components/VoicePanel";

export default function DashboardPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-zinc-500 mt-1">Overview and quick controls</p>
      <div className="mt-8">
        <VoicePanel />
      </div>
    </main>
  );
}
