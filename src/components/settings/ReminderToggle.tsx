'use client';

import { useEffect, useState } from 'react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Quiet on/off switch for the 7 pm reminder. Permission is asked only when you turn it on. */
export default function ReminderToggle() {
  const [on, setOn] = useState<boolean | null>(null); // null = still loading
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('settings');
        const data: { reminderEnabled?: unknown } = await res.json();
        if (!cancelled) setOn(data.reminderEnabled === true);
      } catch {
        if (!cancelled) setNote("Couldn't load the reminder setting. Reload to try again.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function turnOn(): Promise<boolean> {
    if (!PUBLIC_KEY) { setNote("Reminder isn't set up yet."); return false; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setNote("This browser can't show reminders.");
      return false;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { setNote('Reminders work in the installed app, not in dev.'); return false; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setNote('Notifications are blocked for this app.'); return false; }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) { setNote("Couldn't turn it on. Try again."); return false; }
    return true;
  }

  async function turnOff(): Promise<boolean> {
    const res = await fetch('/api/push/subscribe', { method: 'DELETE' });
    if (!res.ok) { setNote("Couldn't turn it off. Try again."); return false; }
    return true;
  }

  async function toggle() {
    if (busy || on === null) return;
    setBusy(true);
    setNote('');
    try {
      const ok = on ? await turnOff() : await turnOn();
      if (ok) setOn(!on);
    } catch {
      setNote('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const loading = on === null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>7 pm reminder</div>
          <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            A quiet nudge to log your day. Works in the installed app.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on === true}
          aria-label="7 pm reminder"
          onClick={toggle}
          disabled={busy || loading}
          className="relative h-7 w-12 shrink-0 rounded-full border disabled:opacity-50"
          style={{
            background: on ? 'var(--accent-fill)' : 'var(--surface-3)',
            borderColor: on ? 'var(--accent-fill)' : 'var(--border-strong)',
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
            style={{ left: on ? 24 : 2, transition: 'left 120ms ease-out' }}
            aria-hidden="true"
          />
        </button>
      </div>
      {note && (
        <p role="status" className="pt-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
          {note}
        </p>
      )}
    </div>
  );
}
