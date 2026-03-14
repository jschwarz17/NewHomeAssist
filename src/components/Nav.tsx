import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex gap-4 text-sm">
      <Link href="/" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Home
      </Link>
      <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Dashboard
      </Link>
      <Link href="/shows" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Shows
      </Link>
      <Link href="/artists" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Artists
      </Link>
      <Link href="/substack" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Articles
      </Link>
      <Link href="/settings" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Settings
      </Link>
    </nav>
  );
}
