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
      <Link href="/devices" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Devices
      </Link>
      <Link href="/routines" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Routines
      </Link>
      <Link href="/settings" className="text-zinc-400 hover:text-zinc-100 transition-colors">
        Settings
      </Link>
    </nav>
  );
}
