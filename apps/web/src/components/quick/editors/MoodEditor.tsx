'use client';

import { MOODS } from '@journaling/core/mood';
import type { EditorProps } from './types';

export default function MoodEditor({ date, payload, onSave }: EditorProps) {
  const current = payload.days[date]?.mood ?? null;
  return (
    <div className="grid grid-cols-4 gap-2">
      {MOODS.map((m) => (
        <button
          key={m.score}
          type="button"
          aria-pressed={current === m.score}
          aria-label={`${m.score}, ${m.label}`}
          onClick={() => onSave([{ key: `mood:${date}`, url: '/api/moods', method: 'POST', body: { date, score: m.score } }])}
          className="quick-tile flex min-h-14 flex-col items-center justify-center rounded-xl text-xs"
          style={{
            background: current === m.score ? 'var(--ok-soft)' : 'var(--surface-alt)',
            boxShadow: current === m.score ? '0 0 0 1.5px var(--ok)' : undefined,
          }}
        >
          <span className="text-xl leading-none">{m.emoji}</span>
          <span className="mt-1 tabular-nums muted">{m.score}</span>
        </button>
      ))}
    </div>
  );
}
