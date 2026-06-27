"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { parseSpreadsheetId } from '@/lib/setup';

const serviceAccountEmail = process.env.NEXT_PUBLIC_SERVICE_ACCOUNT_EMAIL || '';

export default function SetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = session?.user?.name?.split(' ')[0] || '';

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(serviceAccountEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may be unavailable */ }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const subAccountName = (name.trim() || defaultName).trim();
    if (!subAccountName) { setError('Please enter a name'); setLoading(false); return; }

    const id = parseSpreadsheetId(existingId);
    if (!id) { setError('Please enter a spreadsheet URL or ID'); setLoading(false); return; }

    try {
      const res = await fetch('/api/setup/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: id, subAccountName }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'Could not connect that spreadsheet');
        setLoading(false);
        return;
      }
      const { spreadsheetId } = await res.json();
      await update({ spreadsheetId, activeSubAccount: subAccountName });
      router.push('/');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Set up your journal</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Connect your own Google Sheet to store your data.
        </p>
      </div>

      {session?.user && (
        <div className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          {session.user.image && (
            <img src={session.user.image} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div>
            <div className="text-sm font-medium">{session.user.name}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{session.user.email}</div>
          </div>
        </div>
      )}

      {/* How to connect */}
      <ol className="space-y-2 text-sm" style={{ color: 'var(--text)' }}>
        <li>
          1. Create a Google Sheet you own (a blank one is fine —{' '}
          <a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            sheets.new
          </a>
          ).
        </li>
        <li>
          2. Click <strong>Share</strong> and add this address as an <strong>Editor</strong>:
        </li>
      </ol>

      {serviceAccountEmail ? (
        <button
          type="button"
          onClick={copyEmail}
          className="w-full rounded-lg border px-3 py-2 text-left text-sm break-all"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          title="Click to copy"
        >
          <span style={{ fontWeight: 600 }}>{serviceAccountEmail}</span>
          <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {copied ? 'Copied!' : '(tap to copy)'}
          </span>
        </button>
      ) : (
        <div className="rounded-lg border px-3 py-2 text-sm text-red-600" style={{ borderColor: 'var(--border)' }}>
          Service account email is not configured. Set NEXT_PUBLIC_SERVICE_ACCOUNT_EMAIL.
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--text)' }}>
        3. Paste the sheet link below and pick a name.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Your name for this account</label>
          <input
            type="text"
            className="w-full input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName || 'e.g. Alex'}
          />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Used to label your data tabs (e.g. Climbs_Alex).
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Spreadsheet URL or ID</label>
          <input
            type="text"
            className="w-full input"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
          />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Paste the full URL or just the ID from docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
          </p>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button type="submit" className="w-full btn" disabled={loading}>
          {loading ? 'Connecting…' : 'Connect sheet'}
        </button>
      </form>
    </main>
  );
}
