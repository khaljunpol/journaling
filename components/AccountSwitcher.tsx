"use client";

import { useEffect, useState } from "react";
import { parseCookies } from "@/lib/apiHelpers";
import { DEFAULT_ACCOUNT } from "@/lib/constants";

const ACCOUNTS = ["Alex", "Sam"] as const;

export default function AccountSwitcher() {
  const [account, setAccount] = useState<string>(DEFAULT_ACCOUNT);

  useEffect(() => {
    const cookieAccount = (() => {
      try { return parseCookies(document.cookie)['account'] ?? null; } catch { return null; }
    })();
    const initial = cookieAccount || (typeof window !== "undefined" ? localStorage.getItem("account") : null);
    setAccount(initial || DEFAULT_ACCOUNT);
    const onStorage = () => {
      const a = localStorage.getItem("account") || DEFAULT_ACCOUNT;
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
        className="input py-1 text-sm"
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
