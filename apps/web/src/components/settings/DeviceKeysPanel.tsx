'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input, { Label } from '@/components/ui/Input';

type Device = { id: string; name: string; createdAt: string };

/** Host the code points at. Decoded here with atob, not via lib/deviceKey (that file uses node:crypto). */
function codeHost(code: string): string {
  try {
    const v = JSON.parse(atob(code)) as { url?: unknown };
    return typeof v.url === 'string' ? new URL(v.url).host : '';
  } catch {
    return '';
  }
}

function addedLine(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return `Added ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** List, add and turn off connected devices. A code lives in state only and is shown once. */
export default function DeviceKeysPanel() {
  const [devices, setDevices] = useState<Device[] | null>(null); // null = not loaded
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const nameId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/device/keys');
        if (!res.ok) throw new Error('keys');
        const data: { keys?: Device[] } = await res.json();
        if (!Array.isArray(data.keys)) throw new Error('keys');
        if (!cancelled) setDevices(data.keys);
      } catch {
        if (!cancelled) setNote("Couldn't load your devices. Reload to try again.");
      }
    })();
    return () => {
      cancelled = true;
      setCode('');
    };
  }, []);

  async function makeCode(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (busy || !trimmed) return;
    setBusy(true);
    setNote('');
    setCode('');
    setCopied(false);
    try {
      const res = await fetch('/api/device/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data: { id?: unknown; name?: unknown; code?: unknown; error?: unknown } = await res.json().catch(() => ({}));
      // The API's 400 messages are written for people, like the 10-device limit.
      if (res.status === 400 && typeof data.error === 'string') {
        setNote(data.error);
        return;
      }
      if (!res.ok || typeof data.id !== 'string' || !data.id || typeof data.code !== 'string' || !data.code) throw new Error('make');
      const added: Device = {
        id: data.id,
        name: typeof data.name === 'string' ? data.name : trimmed,
        createdAt: new Date().toISOString(),
      };
      setCode(data.code);
      setName('');
      setDevices((list) => (list ? [...list, added] : list));
    } catch {
      setNote("Couldn't make a code just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(device: Device) {
    if (busy) return;
    setBusy(true);
    setNote('');
    try {
      const res = await fetch(`/api/device/keys?id=${encodeURIComponent(device.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('off');
      setCode('');
      setCopied(false);
      setDevices((list) => list?.filter((d) => d.id !== device.id) ?? list);
      setNote(`${device.name} is off. It can take up to 30 seconds to stop everywhere.`);
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

  return (
    <div className="space-y-4">
      <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>Connect the phone widget or your watch.</p>

      {devices && devices.length === 0 && (
        <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No devices yet.</p>
      )}
      {devices && devices.length > 0 && (
        <ul className="space-y-2">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[14px]" style={{ color: 'var(--text-1)' }}>{device.name}</p>
                <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{addedLine(device.createdAt)}</p>
              </div>
              <Button variant="outline" small onClick={() => void turnOff(device)} disabled={busy} aria-label={`Turn off ${device.name}`}>
                Turn off
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void makeCode(e)}>
        <Label htmlFor={nameId}>Add a device</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Phone widget"
            maxLength={40}
            autoComplete="off"
            className="min-w-0 flex-1 basis-40"
          />
          <Button type="submit" disabled={busy || !name.trim()}>Make a code</Button>
        </div>
      </form>

      {code && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={code}
              aria-label="Connection code"
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[13px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            <Button variant="outline" small onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            Paste this into the device&apos;s app. It is shown only now.
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
