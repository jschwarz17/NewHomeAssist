"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeaderTitle() {
  const pathname = usePathname();
  const isHome = !pathname || pathname === "/" || pathname === "";

  return (
    <Link
      href="/"
      className="text-xl font-semibold tracking-tight"
    >
      {isHome ? "Casa de Schwarz" : "Jesse Home Assistant"}
    </Link>
  );
}
