"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'create' | 'existing';

function parseSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

export default function SetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('Journaling');
  const [existingId, setExistingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultName = session?.user?.name?.split(' ')[0] || '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const subAccountName = (name.trim() || defaultName).trim();
    if (!subAccountName) { setError('Please enter a name'); setLoading(false); return; }

    try {
      if (mode === 'existing') {
        const id = parseSpreadsheetId(existingId);
        if (!id) { setError('Please enter a spreadsheet URL or ID'); setLoading(false); return; }
        await update({ spreadsheetId: id, activeSubAccount: subAccountName });
        router.push('/');
        return;
      }

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subAccountName, folderName: folder.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'Setup failed');
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
          Connect a Google Sheet to store your data.
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

      {/* Mode toggle */}
      <div className="flex rounded-lg border overflow-hidden text-sm" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => setMode('create')}
          className="flex-1 py-2 font-medium transition"
          style={mode === 'create'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'var(--surface)', color: 'var(--text)' }}
        >
          Create new sheet
        </button>
        <button
          type="button"
          onClick={() => setMode('existing')}
          className="flex-1 py-2 font-medium transition"
          style={mode === 'existing'
            ? { background: 'var(--accent)', color: '#fff' }
            : { background: 'var(--surface)', color: 'var(--text)' }}
        >
          Use existing sheet
        </button>
      </div>

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

        {mode === 'create' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Google Drive folder name</label>
            <input
              type="text"
              className="w-full input"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Journaling"
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              A folder will be created in your Drive. Leave blank to save to root.
            </p>
          </div>
        )}

        {mode === 'existing' && (
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
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button type="submit" className="w-full btn" disabled={loading}>
          {loading
            ? (mode === 'create' ? 'Creating your sheet…' : 'Connecting…')
            : (mode === 'create' ? 'Create my journal' : 'Connect sheet')}
        </button>
      </form>
    </main>
  );
}
