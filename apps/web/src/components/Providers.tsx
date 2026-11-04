"use client";

import { SessionProvider } from 'next-auth/react';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const DemoContext = createContext(false);

/** True when the server runs in demo mode. */
export function useDemo(): boolean {
  return useContext(DemoContext);
}

export default function Providers({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  return (
    <DemoContext.Provider value={demo}>
      <SessionProvider>{children}</SessionProvider>
    </DemoContext.Provider>
  );
}
