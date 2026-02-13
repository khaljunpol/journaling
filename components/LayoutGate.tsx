"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFullPage = pathname?.startsWith("/old-page");
  if (isFullPage) {
    // Full-bleed layout, no container margins/padding
    return <div className="min-h-dvh">{children}</div>;
  }
  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {children}
    </div>
  );
}
