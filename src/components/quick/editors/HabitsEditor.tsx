'use client';

import { useState } from 'react';
import { initialTicks, templateKind } from '@/lib/quickDay';
import type { EditorProps } from './types';

export default function HabitsEditor({ date, payload, onSave }: EditorProps) {
  const day = payload.days[date];
  const active = payload.ctx.activities.filter((a) => a.status !== 'stopped');
  // Archived habits that already have a row on this day stay visible.
  const archived = payload.ctx.activities.filter(
    (a) => a.status === 'stopped' && day?.logs.some((l) => l.activityId === a.id),
  );
  const list = [...active, ...archived];
  const kind = templateKind(date);
  const [start] = useState(() =>
    initialTicks(day?.logs ?? [], payload.habitTemplates?.[kind] ?? null, payload.ctx.activities),
  );
  const [ticked, setTicked] = useState<Set<string>>(start.ticked);

  function toggle(id: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function done() {
    onSave(
      list.map((a) => ({
        key: `log:${date}:${a.id}`,
        url: '/api/logs',
        method: 'POST' as const,
        body: { date, activityId: a.id, completed: ticked.has(a.id) },
      })),
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {list.map((a) => {
          const on = ticked.has(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(a.id)}
                className="quick-tile flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-sm"
                style={{
                  background: on ? 'var(--ok-soft)' : 'var(--surface-alt)',
                  boxShadow: on ? '0 0 0 1.5px var(--ok)' : undefined,
                }}
              >
                <span>{a.name}</span>
                <span aria-hidden="true" style={{ color: on ? 'var(--ok)' : 'var(--muted-foreground)' }}>
                  {on ? '✓' : '○'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {start.fromTemplate && <p className="subtle">Started from your usual {kind} habits</p>}
      {list.length === 0 && <p className="subtle">No habits yet.</p>}
      <button type="button" className="btn min-h-12 w-full" onClick={done} disabled={list.length === 0}>
        Done
      </button>
    </div>
  );
}
