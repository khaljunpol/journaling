'use client';

import { useState } from 'react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Quiet on/off switch for the 7 pm reminder. Permission is asked only when you turn it on. */
export default function ReminderToggle({ initial, disabled }: { initial: boolean; disabled: boolean }) {
  const [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const on = override ?? initial;

  async function turnOn() {
    if (!PUBLIC_KEY) return setNote("Reminder isn't set up yet.");
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setNote("This browser can't show reminders.");
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return setNote('Reminders work in the installed app, not in dev.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return setNote('Notifications are blocked for this app.');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return setNote("Couldn't turn it on. Try again.");
    setOverride(true);
  }

  async function turnOff() {
    const res = await fetch('/api/push/subscribe', { method: 'DELETE' });
    if (!res.ok) return setNote("Couldn't turn it off. Try again.");
    setOverride(false);
  }

  async function toggle() {
    if (busy || disabled) return;
    setBusy(true);
    setNote('');
    try {
      if (on) await turnOff();
      else await turnOn();
    } catch {
      setNote('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-center text-xs muted">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || disabled}
        aria-pressed={on}
        className="min-h-11 rounded-lg px-3 underline-offset-2 hover:underline disabled:opacity-50"
      >
        7 pm reminder: {on ? 'on' : 'off'}
      </button>
      {note && (
        <p role="status" className="pb-1">
          {note}
        </p>
      )}
    </div>
  );
}
