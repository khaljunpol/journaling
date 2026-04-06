"use client";

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button
      className="rounded-md border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Logout
    </button>
  );
}
