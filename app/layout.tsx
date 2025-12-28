import './globals.css';
import type { ReactNode } from 'react';

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
            <h1 className="text-2xl font-semibold">Journaling</h1>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
