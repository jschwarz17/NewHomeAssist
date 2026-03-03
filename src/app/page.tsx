import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <section className="space-y-6">
          <h2 className="text-lg font-medium text-zinc-300">Dashboard</h2>
          <p className="text-zinc-500">
            Next.js is the brain: TypeScript, Tailwind CSS, and the App Router
            power your home control and automation.
          </p>

          <nav className="flex flex-wrap gap-3 pt-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/devices"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Devices
            </Link>
            <Link
              href="/routines"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Routines
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Settings
            </Link>
          </nav>
        </section>
    </main>
  );
}
