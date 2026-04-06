"use client";

import { useState } from 'react';
import type { Sidequest, SidequestLog } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────

function fmtVal(value: number, unit?: string): string {
  if (!unit) return String(value);
  // time formatting: if unit is 'min' or 'sec', format nicely
  if (unit === 'sec') {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  return `${value} ${unit}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Sub-components per type ───────────────────────────────────

function MilestoneCard({ sq, logs, onLog, onToggleComplete }: {
  sq: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
  onToggleComplete: () => Promise<void>;
}) {
  const milestones = sq.milestones || [];
  const completedIndices = new Set(logs.filter((l) => l.milestoneIndex != null).map((l) => l.milestoneIndex!));
  const progress = completedIndices.size;
  const pct = milestones.length > 0 ? Math.round((progress / milestones.length) * 100) : 0;
  const nextIdx = milestones.findIndex((_, i) => !completedIndices.has(i));

  async function checkMilestone(idx: number) {
    if (completedIndices.has(idx)) return;
    const today = new Date().toISOString().slice(0, 10);
    await onLog({ milestoneIndex: idx, date: today });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'var(--accent)' }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
          {progress}/{milestones.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {milestones.map((m, i) => {
          const done = completedIndices.has(i);
          const isNext = i === nextIdx;
          return (
            <button
              key={i}
              onClick={() => !done && checkMilestone(i)}
              disabled={done}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={done
                ? { background: 'var(--accent)', color: 'var(--accent-foreground)', opacity: 0.9 }
                : isNext
                  ? { background: 'var(--surface-alt)', color: 'var(--text)', boxShadow: '0 0 0 1.5px var(--accent)' }
                  : { background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }
              }
            >
              {done ? '✓' : isNext ? '○' : '·'}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {sq.completedAt && (
        <div className="text-xs" style={{ color: 'var(--accent)' }}>
          Completed {fmtDate(sq.completedAt)}
        </div>
      )}
    </div>
  );
}

function PBCard({ sq, logs, onLog }: {
  sq: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
}) {
  const [inputVal, setInputVal] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const entries = logs
    .filter((l) => l.value != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const best = entries.length > 0 ? Math.max(...entries.map((e) => e.value!)) : null;

  async function submit() {
    const v = parseFloat(inputVal);
    if (!isFinite(v)) return;
    setSaving(true);
    try {
      await onLog({ value: v, note: note.trim() || undefined, date: new Date().toISOString().slice(0, 10) });
      setInputVal(''); setNote(''); setShowForm(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Best</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
            {best != null ? fmtVal(best, sq.unit) : '—'}
          </div>
        </div>
        <div className="flex-1 h-8">
          {entries.length > 1 && (
            <svg viewBox={`0 0 ${entries.length * 12} 32`} className="w-full h-full" preserveAspectRatio="none">
              {(() => {
                const min = Math.min(...entries.map((e) => e.value!));
                const max = Math.max(...entries.map((e) => e.value!));
                const range = max - min || 1;
                const pts = entries.map((e, i) => `${i * 12},${32 - ((e.value! - min) / range) * 28}`).join(' ');
                return <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
              })()}
            </svg>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
          style={{ background: showForm ? 'var(--accent)' : 'var(--surface-alt)', color: showForm ? 'var(--accent-foreground)' : 'var(--text)' }}
        >
          + Log
        </button>
      </div>

      {showForm && (
        <div className="flex gap-2">
          <input
            type="number"
            step="any"
            className="input flex-1 py-1.5 text-sm"
            placeholder={sq.unit ? `Value (${sq.unit})` : 'Value'}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
          <input
            type="text"
            className="input w-24 py-1.5 text-sm"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn py-1.5 text-sm" onClick={submit} disabled={saving || !inputVal}>
            {saving ? '…' : 'Save'}
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-0.5">
          {[...entries].reverse().slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs py-0.5">
              <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(e.date)}</span>
              <span className="font-medium tabular-nums">{fmtVal(e.value!, sq.unit)}</span>
              {e.note && <span style={{ color: 'var(--muted-foreground)' }}>{e.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimedCard({ sq, logs, onLog }: {
  sq: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
}) {
  const [inputTime, setInputTime] = useState('');
  const [inputDist, setInputDist] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // value = seconds, value2 = distance (km)
  const entries = logs
    .filter((l) => l.value != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const best = entries.length > 0 ? entries.reduce((acc, e) => e.value! < acc.value! ? e : acc) : null;

  function parseTimeInput(s: string): number | null {
    // Accept mm:ss or just seconds or just minutes (e.g. "9:30" → 570s, "570" → 570s)
    const parts = s.trim().split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const sec = parseInt(parts[1], 10);
      if (!isFinite(m) || !isFinite(sec)) return null;
      return m * 60 + sec;
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  async function submit() {
    const timeSec = parseTimeInput(inputTime);
    if (timeSec == null) return;
    const dist = inputDist ? parseFloat(inputDist) : undefined;
    setSaving(true);
    try {
      await onLog({
        value: timeSec,
        value2: dist,
        note: note.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      });
      setInputTime(''); setInputDist(''); setNote(''); setShowForm(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Best</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
            {best ? fmtVal(best.value!, 'sec') : '—'}
          </div>
          {best?.value2 && (
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{best.value2} km</div>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium transition-all"
          style={{ background: showForm ? 'var(--accent)' : 'var(--surface-alt)', color: showForm ? 'var(--accent-foreground)' : 'var(--text)' }}
        >
          + Log run
        </button>
      </div>

      {showForm && (
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            className="input w-24 py-1.5 text-sm"
            placeholder="Time (m:ss)"
            value={inputTime}
            onChange={(e) => setInputTime(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
          <input
            type="number"
            step="0.01"
            className="input w-20 py-1.5 text-sm"
            placeholder="km"
            value={inputDist}
            onChange={(e) => setInputDist(e.target.value)}
          />
          <input
            type="text"
            className="input flex-1 py-1.5 text-sm"
            placeholder="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn py-1.5 text-sm" onClick={submit} disabled={saving || !inputTime}>
            {saving ? '…' : 'Save'}
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-0.5">
          {[...entries].reverse().slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center gap-3 text-xs py-0.5">
              <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(e.date)}</span>
              <span className="font-medium tabular-nums">{fmtVal(e.value!, 'sec')}</span>
              {e.value2 && <span style={{ color: 'var(--muted-foreground)' }}>{e.value2} km</span>}
              {e.note && <span style={{ color: 'var(--muted-foreground)' }}>{e.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountCard({ sq, logs, onLog }: {
  sq: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const total = logs.reduce((acc, l) => acc + (l.value ?? 1), 0);
  const target = sq.target ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

  async function logOne() {
    setSaving(true);
    try {
      await onLog({ value: 1, date: new Date().toISOString().slice(0, 10) });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{total}</span>
            {target > 0 && <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>/ {target} {sq.unit || 'times'}</span>}
          </div>
          {target > 0 && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : 'var(--accent)' }}
              />
            </div>
          )}
        </div>
        <button
          onClick={logOne}
          disabled={saving}
          className="rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95"
          style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          {saving ? '…' : '+ 1'}
        </button>
      </div>
    </div>
  );
}

function OneoffCard({ sq, onLog, onToggleComplete }: {
  sq: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
  onToggleComplete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const done = !!sq.completedAt;

  async function toggle() {
    setSaving(true);
    try { await onToggleComplete(); } finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={saving}
        className="h-8 w-8 rounded-full flex items-center justify-center text-lg transition-all active:scale-90 shrink-0"
        style={done
          ? { background: 'var(--accent)', color: 'var(--accent-foreground)' }
          : { background: 'var(--surface-alt)', border: '2px solid var(--border)', color: 'transparent' }
        }
      >
        {done ? '✓' : ''}
      </button>
      <div>
        {done
          ? <span className="text-sm" style={{ color: 'var(--accent)' }}>Done · {fmtDate(sq.completedAt!)}</span>
          : <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Not done yet — tap to complete</span>
        }
      </div>
    </div>
  );
}

// ── Type badges ───────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  milestone: 'Milestones',
  pb: 'Personal Best',
  timed: 'Timed',
  count: 'Count',
  oneoff: 'One-off',
};

const TYPE_COLOR: Record<string, string> = {
  milestone: '#8b5cf6',
  pb: '#f59e0b',
  timed: '#3b82f6',
  count: '#10b981',
  oneoff: '#6b7280',
};

// ── Main Card ─────────────────────────────────────────────────

export default function SidequestCard({
  sidequest,
  logs,
  onLog,
  onUpdate,
  onDelete,
  onEdit,
  compact = false,
}: {
  sidequest: Sidequest;
  logs: SidequestLog[];
  onLog: (data: Partial<SidequestLog>) => Promise<void>;
  onUpdate: (patch: Partial<Sidequest>) => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit?: () => void;
  compact?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sq = sidequest;
  const color = TYPE_COLOR[sq.type] || 'var(--accent)';

  async function handleToggleComplete() {
    if (sq.completedAt) {
      await onUpdate({ completedAt: undefined });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      await onLog({ date: today, complete: true } as Partial<SidequestLog> & { complete?: boolean });
      await onUpdate({ completedAt: today });
    }
  }

  return (
    <div
      className="card p-4 sm:p-5 space-y-3 relative"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-base'} truncate`}>
              {sq.title}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
              style={{ background: `${color}18`, color }}
            >
              {TYPE_LABEL[sq.type]}
            </span>
          </div>
          {sq.description && !compact && (
            <p className="text-sm mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
              {sq.description}
            </p>
          )}
        </div>

        {!compact && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              ···
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-36 card p-1 z-20 shadow-lg space-y-0.5"
                style={{ borderColor: 'var(--border)' }}
              >
                {onEdit && (
                  <button
                    className="w-full text-left rounded px-2 py-1.5 text-sm transition hover:bg-[var(--surface-alt)]"
                    onClick={() => { setMenuOpen(false); onEdit(); }}
                    style={{ color: 'var(--text)' }}
                  >
                    Edit
                  </button>
                )}
                <button
                  className="w-full text-left rounded px-2 py-1.5 text-sm transition hover:bg-[var(--surface-alt)]"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body — type-specific */}
      {!compact && (
        <>
          {sq.type === 'milestone' && (
            <MilestoneCard sq={sq} logs={logs} onLog={onLog} onToggleComplete={handleToggleComplete} />
          )}
          {sq.type === 'pb' && (
            <PBCard sq={sq} logs={logs} onLog={onLog} />
          )}
          {sq.type === 'timed' && (
            <TimedCard sq={sq} logs={logs} onLog={onLog} />
          )}
          {sq.type === 'count' && (
            <CountCard sq={sq} logs={logs} onLog={onLog} />
          )}
          {sq.type === 'oneoff' && (
            <OneoffCard sq={sq} logs={logs} onLog={onLog} onToggleComplete={handleToggleComplete} />
          )}
        </>
      )}

      {/* Compact body — just progress summary */}
      {compact && (
        <CompactBody sq={sq} logs={logs} color={color} />
      )}
    </div>
  );
}

function CompactBody({ sq, logs, color }: { sq: Sidequest; logs: SidequestLog[]; color: string }) {
  if (sq.type === 'milestone') {
    const milestones = sq.milestones || [];
    const done = new Set(logs.filter((l) => l.milestoneIndex != null).map((l) => l.milestoneIndex!)).size;
    const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0;
    return (
      <div className="space-y-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{done}/{milestones.length} checkpoints</div>
      </div>
    );
  }
  if (sq.type === 'pb') {
    const best = logs.filter((l) => l.value != null).reduce<number | null>((acc, l) => acc == null || l.value! > acc ? l.value! : acc, null);
    return <div className="text-sm font-medium">{best != null ? fmtVal(best, sq.unit) : '—'}</div>;
  }
  if (sq.type === 'timed') {
    const best = logs.filter((l) => l.value != null).reduce<number | null>((acc, l) => acc == null || l.value! < acc ? l.value! : acc, null);
    return <div className="text-sm font-medium">{best != null ? fmtVal(best, 'sec') : '—'}</div>;
  }
  if (sq.type === 'count') {
    const total = logs.reduce((acc, l) => acc + (l.value ?? 1), 0);
    const target = sq.target ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    return (
      <div className="space-y-1">
        <div className="text-sm font-medium tabular-nums">{total}{target > 0 ? ` / ${target}` : ''} <span className="text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>{sq.unit || 'times'}</span></div>
        {target > 0 && <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>}
      </div>
    );
  }
  return (
    <div className="text-sm" style={{ color: sq.completedAt ? color : 'var(--muted-foreground)' }}>
      {sq.completedAt ? `Done · ${fmtDate(sq.completedAt)}` : 'Not done yet'}
    </div>
  );
}
