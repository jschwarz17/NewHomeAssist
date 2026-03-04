"use client";

import { usePathname } from "next/navigation";
import { AppHeaderTitle } from "@/components/AppHeaderTitle";
import { Nav } from "@/components/Nav";

export function LayoutHeader() {
  const pathname = usePathname();
  const isHome = !pathname || pathname === "/" || pathname === "";

  if (isHome) return null;

  return (
    <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <AppHeaderTitle />
      <Nav />
    </header>
  );
}
