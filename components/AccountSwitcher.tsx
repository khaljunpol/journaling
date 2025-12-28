"use client";

import { useEffect, useState } from "react";

const ACCOUNTS = ["Alex", "Sam"] as const;

export default function AccountSwitcher() {
  const [account, setAccount] = useState<string>("Alex");

  useEffect(() => {
    const cookieAccount = (() => {
      try {
        const m = document.cookie.match(/(?:^|;\s*)account=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : null;
      } catch { return null; }
    })();
    const initial = cookieAccount || (typeof window !== "undefined" ? localStorage.getItem("account") : null);
    setAccount(initial || "Alex");
    const onStorage = () => {
      const a = localStorage.getItem("account") || "Alex";
      setAccount(a);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const a = e.target.value;
    setAccount(a);
    try {
      localStorage.setItem("account", a);
      // Notify other components quickly
      window.dispatchEvent(new StorageEvent("storage", { key: "account", newValue: a } as any));
      window.dispatchEvent(new CustomEvent("account-change", { detail: a }));
      // Also set a readable cookie so server components can read the selection
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `account=${encodeURIComponent(a)}; path=/; max-age=${maxAge}; samesite=lax`;
    } catch {}
  };

  return (
    <label className="inline-flex items-center gap-3 text-sm">
      <select
        value={account}
        onChange={onChange}
        title="Switch account"
        className="rounded-md border border-black bg-black px-3 py-1 text-white shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:focus-visible:ring-white"
        aria-label="Select account"
      >
        {ACCOUNTS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
