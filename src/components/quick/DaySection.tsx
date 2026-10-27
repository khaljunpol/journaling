'use client';

import { useState } from 'react';
import Link from 'next/link';
import { dayStatus, missingInOrder, type ItemKey } from '@/lib/quickDay';
import { itemsForTile } from '@/lib/quickApply';
import { moodEmoji } from '@/lib/mood';
import { parseLocalDate } from '@/lib/date';
import type { QuickPayload } from '@/lib/quickPayload';
import type { OutboxItem } from '@/lib/outbox';

const NAMES: Record<ItemKey, string> = {
  mood: 'Mood',
  habits: 'Habits',
  weight: 'Weight',
  sidequests: 'Quests',
  hours: 'Hours',
  highlight: 'Highlight',
  climb: 'Climb',
};

type Props = {
  date: string;
  label: string;
  payload: QuickPayload;
  queue: OutboxItem[];
  onOpen: (date: string, key: ItemKey) => void;
  onFill?: (date: string) => void;
};

function Tile(props: {
  name: string;
  value: string;
  filled: boolean;
  counts: boolean;
  pending: boolean;
  failed: boolean;
  onClick: () => void;
}) {
  const { name, value, filled, counts, pending, failed, onClick } = props;
  // Pop once when the tile becomes filled (not on first paint).
  const [prev, setPrev] = useState(filled);
  const [pop, setPop] = useState(false);
  if (prev !== filled) {
    setPrev(filled);
    setPop(filled);
  }
  const dashed = !filled && counts;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}: ${value || 'empty'}${pending ? ', saving' : ''}${failed ? ", didn't save" : ''}`}
      className={`quick-tile relative flex min-h-[4.75rem] flex-col items-start justify-between rounded-xl p-2.5 text-left ${pop ? 'quick-pop' : ''}`}
      style={{
        background: filled ? 'var(--ok-soft)' : 'var(--surface-alt)',
        outline: dashed ? '2px dashed var(--muted-foreground)' : undefined,
        outlineOffset: dashed ? '-2px' : undefined,
      }}
    >
      <span className="text-xs muted">{name}</span>
      <span className="w-full truncate text-sm font-medium">{failed ? "Didn't save, tap to fix" : value}</span>
      {pending && !failed && (
        <span
          className="absolute right-2 top-2 h-2 w-2 rounded-full"
          style={{ background: 'var(--sync)' }}
          role="img"
          aria-label="Saving"
        />
      )}
    </button>
  );
}

export default function DaySection({ date, label, payload, queue, onOpen, onFill }: Props) {
  const day = payload.days[date];
  if (!day) {
    return (
      <section className="card p-3" aria-label={label}>
        <h2 className="text-sm font-semibold">{label}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-h-[4.75rem] rounded-xl" style={{ background: 'var(--surface-alt)' }} />
          ))}
        </div>
      </section>
    );
  }

  const status = dayStatus(day, payload.ctx);
  const missing = missingInOrder(status).length;
  const weekday = parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });
  const activeIds = payload.ctx.activities.filter((a) => a.status !== 'stopped').map((a) => a.id);
  const habitsDone = day.logs.filter((l) => l.completed && activeIds.includes(l.activityId)).length;
  const questsCount = payload.ctx.sidequests.filter(
    (q) => (q.type === 'count' || q.type === 'timed') && !q.completedAt && q.year === payload.ctx.year,
  ).length;
  const hoursSet = day.hours.filter((h) => h !== null).length;

  function valueOf(key: ItemKey): string {
    switch (key) {
      case 'mood':
        return day.mood === null ? '' : `${moodEmoji(day.mood)} ${day.mood}`;
      case 'habits':
        return `${habitsDone}/${activeIds.length}`;
      case 'weight':
        return day.weight === null ? '' : String(day.weight);
      case 'sidequests':
        return day.sidequestLogIds.length ? `${day.sidequestLogIds.length}/${questsCount} logged` : '';
      case 'hours':
        return hoursSet === 0 ? '' : status.items.find((i) => i.key === 'hours')?.filled ? '24 h' : `${hoursSet}/24 h`;
      case 'highlight':
        return day.highlight.trim();
      default:
        return '';
    }
  }

  return (
    <section className="card p-3" aria-label={label}>
      <h2 className="flex items-baseline justify-between text-sm font-semibold">
        {label}
        <small className="font-normal muted">
          {status.filled}/{status.total} · {weekday}
        </small>
      </h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {status.items
          .filter((i) => i.shown)
          .map((i) => {
            if (i.key === 'climb') {
              return (
                <div
                  key="climb"
                  className="relative flex min-h-[4.75rem] flex-col items-start justify-between rounded-xl p-2.5"
                  style={{ background: 'var(--ok-soft)' }}
                >
                  <span className="text-xs muted">Climb</span>
                  <span className="text-sm font-medium">
                    {day.climbs} {day.climbs === 1 ? 'send' : 'sends'}
                  </span>
                  <Link
                    href="/climbing-log"
                    aria-label="Add a climb"
                    className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-lg"
                  >
                    +
                  </Link>
                </div>
              );
            }
            const items = itemsForTile(queue, i.key, date);
            return (
              <Tile
                key={i.key}
                name={NAMES[i.key]}
                value={valueOf(i.key)}
                filled={i.filled}
                counts={i.counts}
                pending={items.some((q) => q.state === 'pending')}
                failed={items.some((q) => q.state === 'failed')}
                onClick={() => onOpen(date, i.key)}
              />
            );
          })}
      </div>
      {missing > 0 ? (
        <button
          type="button"
          onClick={() => onFill?.(date)}
          className="btn mt-3 min-h-11 w-full font-semibold"
        >
          Fill {missing} missing ▶
        </button>
      ) : (
        <p className="mt-3 text-center text-xs muted">All filled. Nice.</p>
      )}
    </section>
  );
}
