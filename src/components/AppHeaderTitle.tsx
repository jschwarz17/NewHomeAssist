"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeaderTitle() {
  const pathname = usePathname();
  const isHome = !pathname || pathname === "/" || pathname === "";

  if (isHome) return null;

  return (
    <Link
      href="/"
      className="text-xl font-semibold tracking-tight"
    >
      Jesse Home Assistant
    </Link>
  );
}
