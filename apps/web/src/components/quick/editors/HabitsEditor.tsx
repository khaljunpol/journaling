'use client';

import { useState } from 'react';
import { habitLogSpecs, initialTicks, templateKind } from '@journaling/core/quickDay';
import type { EditorProps } from './types';

export default function HabitsEditor({ date, payload, onSave }: EditorProps) {
  const day = payload.days[date];
  const list = payload.ctx.activities;
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
    onSave(habitLogSpecs(date, list.map((a) => ({ activityId: a.id, completed: ticked.has(a.id) }))));
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
