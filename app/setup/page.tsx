"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('Journaling');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive default name from Google display name
  const defaultName = session?.user?.name?.split(' ')[0] || '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const subAccountName = (name.trim() || defaultName).trim();
    if (!subAccountName) { setError('Please enter a name'); setLoading(false); return; }
    try {
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
      // Update the session JWT with spreadsheetId and active sub-account
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
          We'll create a Google Sheet in your Drive to store your data.
        </p>
      </div>

      {session?.user && (
        <div className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          {session.user.image && (
            <img src={session.user.image} alt="" className="h-9 w-9 rounded-full" />
          )}
          <div>
            <div className="text-sm font-medium">{session.user.name}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{session.user.email}</div>
          </div>
        </div>
      )}

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
            Used to label your data tabs (e.g. Climbs_Alex). You can add more accounts later.
          </p>
        </div>

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
            A folder will be created in your Drive with this name. Leave blank to save to root.
          </p>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button type="submit" className="w-full btn" disabled={loading}>
          {loading ? 'Creating your sheet…' : 'Create my journal'}
        </button>
      </form>
    </main>
  );
}
