import AppHeader from '@/components/AppHeader';
import type { ReactNode } from 'react';
// @ts-ignore: side-effect global CSS import for Next.js
import './globals.css';

export const metadata = {
    title: 'Journaling',
    description: 'Daily activities, highlights, and consistency metrics',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-dvh overflow-x-hidden">
                <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
                    <AppHeader />
                    {children}
                </div>
            </body>
        </html>
    );
}
