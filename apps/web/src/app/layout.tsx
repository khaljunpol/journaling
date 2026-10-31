import ConnectionGate from '@/components/ConnectionGate';
import LayoutGate from '@/components/LayoutGate';
import Providers from '@/components/Providers';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono, Pixelify_Sans } from 'next/font/google';
// @ts-ignore: side-effect global CSS import for Next.js
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
const pixelify = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel', display: 'swap' });

// Runs before paint: dark unless the visitor saved 'light'.
const themeScript = "try{document.documentElement.setAttribute('data-theme',localStorage.getItem('theme')==='light'?'light':'dark')}catch(e){}";

export const viewport = { viewportFit: 'cover' as const };

export const metadata = {
    title: 'Journaling',
    description: 'Daily activities, highlights, and consistency metrics',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" data-theme="dark" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${pixelify.variable}`}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className="min-h-dvh overflow-x-hidden">
                <Providers>
                    <ServiceWorkerRegister />
                    <LayoutGate>
                        <ConnectionGate>{children}</ConnectionGate>
                    </LayoutGate>
                </Providers>
            </body>
        </html>
    );
}
