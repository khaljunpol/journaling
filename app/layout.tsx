import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import AccountSwitcher from '@/components/AccountSwitcher';

export const metadata = {
  title: 'Journaling',
  description: 'Daily activities, highlights, and consistency metrics',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-black dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <header className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">Journaling</h1>
              <AccountSwitcher />
            </div>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="underline-offset-2 hover:underline">Dashboard</Link>
              <Link href="/journal" className="underline-offset-2 hover:underline">Journal</Link>
              <Link href="/activities" className="underline-offset-2 hover:underline">Activities</Link>
              <Link href="/metrics" className="underline-offset-2 hover:underline">Metrics</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
