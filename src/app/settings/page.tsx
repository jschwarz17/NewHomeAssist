import { EagleEnrollSection } from "@/components/settings/EagleEnrollSection";

export default function SettingsPage() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-zinc-500 mt-1">Integrations and preferences</p>
      <p className="text-zinc-500 mt-6">
        Connect smart home platforms, configure the brain, and manage users.
      </p>
      <EagleEnrollSection />
    </main>
  );
}
