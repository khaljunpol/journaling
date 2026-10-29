'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';

/** Host the code points at. Decoded here with atob, not via lib/widgetKey (that file uses node:crypto). */
function codeHost(code: string): string {
  try {
    const v = JSON.parse(atob(code)) as { url?: unknown };
    return typeof v.url === 'string' ? new URL(v.url).host : '';
  } catch {
    return '';
  }
}

/** Make or turn off the Android widget key. The code lives in state only and is shown once. */
export default function WidgetKeyPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = still loading
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('settings');
        const data: { widgetEnabled?: unknown } = await res.json();
        if (!cancelled) setEnabled(data.widgetEnabled === true);
      } catch {
        if (!cancelled) setNote("Couldn't load the widget setting. Reload to try again.");
      }
    })();
    return () => {
      cancelled = true;
      setCode('');
    };
  }, []);

  async function makeKey() {
    if (busy) return;
    setBusy(true);
    setNote('');
    setCopied(false);
    try {
      const res = await fetch('/api/widget/key', { method: 'POST' });
      if (!res.ok) throw new Error('make');
      const data: { code?: unknown } = await res.json();
      if (typeof data.code !== 'string' || !data.code) throw new Error('make');
      setCode(data.code);
      setEnabled(true);
    } catch {
      setNote("Couldn't make a key just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch('/api/widget/key', { method: 'DELETE' });
      if (!res.ok) throw new Error('off');
      setCode('');
      setCopied(false);
      setEnabled(false);
      setNote('Widget is off. It can take up to 30 seconds to stop everywhere.');
    } catch {
      setNote("Couldn't turn it off just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setNote('Copied'); // the status line is what screen readers announce
    } catch {
      setNote("Couldn't copy. Select the code and copy it by hand.");
    }
  }

  const host = code ? codeHost(code) : '';

  const loading = enabled === null && !note;

  return (
    <div className="space-y-3">
      <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>Connect the Journal widget on your phone.</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void makeKey()} disabled={busy || loading}>
          {enabled ? 'Make a new key' : 'Make a key'}
        </Button>
        {enabled && (
          <Button variant="outline" small onClick={() => void turnOff()} disabled={busy}>
            Turn off
          </Button>
        )}
      </div>
      {enabled && !code && (
        <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Replaces your current key</p>
      )}

      {code && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={code}
              aria-label="Widget key"
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[13px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            <Button variant="outline" small onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            Paste this into the Journal widget app. It is shown only now.
          </p>
          {host && (
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
              This code points to {host}.
            </p>
          )}
        </div>
      )}

      {note && (
        <p role="status" className="text-[13px]" style={{ color: 'var(--text-2)' }}>
          {note}
        </p>
      )}
    </div>
  );
}
