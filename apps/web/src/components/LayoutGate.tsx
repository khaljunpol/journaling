"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";

export default function LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = pathname?.startsWith("/login") || pathname?.startsWith("/setup");
  if (isFullBleed) {
    // Full-bleed layout, no container margins/padding
    return <div className="min-h-dvh">{children}</div>;
  }
  return <AppShell>{children}</AppShell>;
}
