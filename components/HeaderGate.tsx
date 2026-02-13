"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function HeaderGate({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    if (pathname?.startsWith("/old-page")) return null;
    return <>{children}</>;
}
