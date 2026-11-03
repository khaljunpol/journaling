'use client';

import { useState } from 'react';
import { splitHabits } from '@journaling/core/habitCategory';
import { habitLogSpecs, initialTicks, templateKind } from '@journaling/core/quickDay';
import type { EditorProps } from './types';

function HabitTile({ name, on, muted, onToggle }: { name: string; on: boolean; muted: boolean; onToggle: () => void }) {
  const ring = muted ? 'var(--border-strong)' : 'var(--ok)';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="quick-tile flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-sm"
      style={{
        background: on ? (muted ? 'var(--surface-3)' : 'var(--ok-soft)') : 'var(--surface-alt)',
        boxShadow: on ? `0 0 0 1.5px ${ring}` : undefined,
      }}
    >
      <span>{name}</span>
      <span aria-hidden="true" style={{ color: on ? (muted ? 'var(--text-2)' : 'var(--ok)') : 'var(--muted-foreground)' }}>
        {on ? '✓' : '○'}
      </span>
    </button>
  );
}

export default function HabitsEditor({ date, payload, onSave }: EditorProps) {
  const day = payload.days[date];
  const list = payload.ctx.activities;
  const { good, bad } = splitHabits(list);
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
        {good.map((a) => (
          <li key={a.id}><HabitTile name={a.name} on={ticked.has(a.id)} muted={false} onToggle={() => toggle(a.id)} /></li>
        ))}
      </ul>
      {bad.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[13px]" style={{ color: 'var(--text-3)' }}>Tracked only</h3>
          <ul className="space-y-2">
            {bad.map((a) => (
              <li key={a.id}><HabitTile name={a.name} on={ticked.has(a.id)} muted onToggle={() => toggle(a.id)} /></li>
            ))}
          </ul>
        </section>
      ) : null}
      {start.fromTemplate && <p className="subtle">Started from your usual {kind} habits</p>}
      {list.length === 0 && <p className="subtle">No habits yet.</p>}
      <button type="button" className="btn min-h-12 w-full" onClick={done} disabled={list.length === 0}>
        Done
      </button>
    </div>
  );
}
