import AppHeader from '@/components/AppHeader';
import HeaderGate from '../components/HeaderGate';
import LayoutGate from '@/components/LayoutGate';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
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
                <ServiceWorkerRegister />
                <LayoutGate>
                    <HeaderGate>
                        <AppHeader />
                    </HeaderGate>
                    {children}
                </LayoutGate>
            </body>
        </html>
    );
}
