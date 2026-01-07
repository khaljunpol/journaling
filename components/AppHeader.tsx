"use client";

import AccountSwitcher from '@/components/AccountSwitcher';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppHeader() {
  const pathname = usePathname();
  if (pathname?.startsWith('/login')) {
    return null;
  }

  return (
    <header className="mb-4 sm:mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl">Journaling</h1>
          <AccountSwitcher />
        </div>
        <nav className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 text-xs sm:mx-0 sm:gap-4 sm:text-sm">
          <Link href="/" className="whitespace-nowrap underline-offset-2 hover:underline">Dashboard</Link>
          <Link href="/journal" className="whitespace-nowrap underline-offset-2 hover:underline">Journal</Link>
          <Link href="/mood" className="whitespace-nowrap underline-offset-2 hover:underline">Mood</Link>
          <Link href="/activities" className="whitespace-nowrap underline-offset-2 hover:underline">Activities</Link>
          <Link href="/catalog" className="whitespace-nowrap underline-offset-2 hover:underline">Catalog</Link>
          <Link href="/metrics" className="whitespace-nowrap underline-offset-2 hover:underline">Metrics</Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
