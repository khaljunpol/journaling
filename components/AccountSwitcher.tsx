"use client";

import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function AccountSwitcher() {
  const { data: session, update } = useSession();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const active = session?.activeSubAccount || '';

  async function switchTo(name: string) {
    await update({ activeSubAccount: name });
    window.location.reload();
  }

  async function addSubAccount(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await update({ activeSubAccount: name });
    setAdding(false);
    setNewName('');
    window.location.reload();
  }

  if (!session) return null;

  return (
    <div className="relative inline-flex items-center gap-1">
      {active && (
        <span
          className="inline-flex items-center rounded-md px-2 py-1 text-sm font-medium cursor-default"
          style={{ background: 'var(--surface-alt)', color: 'var(--accent)' }}
          title={`Active: ${active}`}
        >
          {active}
        </span>
      )}
      <button
        onClick={() => setAdding((v) => !v)}
        className="btn-outline px-2 py-1 text-xs"
        title="Switch or add sub-account"
      >
        ⊕
      </button>
      {adding && (
        <div
          className="absolute right-0 top-full mt-1 w-52 card p-3 z-40 shadow-lg space-y-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Switch / Add Account</div>
          <form onSubmit={addSubAccount} className="flex gap-1">
            <input
              autoFocus
              type="text"
              className="input flex-1 py-1 text-sm"
              placeholder="e.g. Sam"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn px-2 py-1 text-sm">Go</button>
          </form>
          {active && (
            <button
              className="w-full text-left text-xs px-1 py-0.5 rounded"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={() => switchTo(active)}
            >
              Current: {active}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
