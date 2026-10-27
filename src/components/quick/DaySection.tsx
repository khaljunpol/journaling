'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { dayStatus, missingInOrder, type ItemKey } from '@/lib/quickDay';
import { itemsForTile } from '@/lib/quickApply';
import { moodEmoji } from '@/lib/mood';
import { parseLocalDate } from '@/lib/date';
import type { QuickPayload } from '@/lib/quickPayload';
import type { OutboxItem } from '@/lib/outbox';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';

const NAMES: Record<ItemKey, string> = {
  mood: 'Mood',
  habits: 'Habits',
  weight: 'Weight',
  sidequests: 'Quests',
  hours: 'Hours',
  highlight: 'Highlight',
  climb: 'Climb',
};

/** One word that says what a tap will do. */
const PROMPTS: Record<ItemKey, string> = {
  mood: 'Rate',
  habits: 'Tick',
  weight: 'Add',
  sidequests: 'Log',
  hours: 'Paint',
  highlight: 'Write',
  climb: 'Add',
};

type Props = {
  date: string;
  label: string;
  payload: QuickPayload;
  queue: OutboxItem[];
  onOpen: (date: string, key: ItemKey) => void;
  onFill?: (date: string) => void;
  /** Older days: count only these kinds. */
  only?: ItemKey[];
  /** The one main action on the page. The other day shows a quieter button. */
  primary?: boolean;
};

const TILE = 'quick-tile relative flex min-h-[5.5rem] flex-col items-start justify-between rounded-[10px] p-3 text-left';
const LABEL = 'flex w-full items-center justify-between gap-1 text-[12px] font-medium uppercase tracking-[0.04em]';

function Tile(props: {
  name: string;
  prompt: string;
  value: string;
  big: boolean;
  filled: boolean;
  counts: boolean;
  pending: boolean;
  failed: boolean;
  onClick: () => void;
}) {
  const { name, prompt, value, big, filled, counts, pending, failed, onClick } = props;
  // Pop once when the tile becomes filled (not on first paint).
  const [prev, setPrev] = useState(filled);
  const [pop, setPop] = useState(false);
  if (prev !== filled) {
    setPrev(filled);
    setPop(filled);
  }
  // Empty tiles that count get a dashed outline. Empty tiles that do not count stay plain.
  const border = filled ? 'solid var(--border)' : counts ? 'dashed var(--border-strong)' : 'solid var(--border)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}: ${value || (filled ? 'done' : 'empty')}${pending ? ', saving' : ''}${failed ? ", didn't save" : ''}`}
      className={`${TILE} ${pop ? 'quick-pop' : ''}`}
      style={{ background: filled ? 'var(--surface-2)' : 'transparent', border: `1px ${border}` }}
    >
      <span className={LABEL} style={{ color: 'var(--text-3)' }}>
        {name}
        {filled && !failed && <Check size={14} aria-hidden="true" style={{ color: 'var(--ok)' }} />}
      </span>
      {failed ? (
        <span className="w-full text-[13px] font-medium" style={{ color: 'var(--warn)' }}>
          Didn&apos;t save, tap to fix
        </span>
      ) : filled ? (
        <span
          className={`w-full ${big ? 'num truncate text-[22px] font-semibold leading-none' : 'line-clamp-2 text-[14px] font-medium leading-snug'}`}
          style={{ color: 'var(--text-1)' }}
        >
          {value || 'Done'}
        </span>
      ) : value ? (
        <span className="num w-full truncate text-[14px]" style={{ color: 'var(--text-2)' }}>
          {value}
        </span>
      ) : (
        <span className="w-full text-[14px]" style={{ color: 'var(--text-3)' }}>
          {prompt}
        </span>
      )}
      {pending && !failed && (
        <span
          className="sync-pulse absolute bottom-2 right-2 h-2 w-2 rounded-full"
          style={{ background: 'var(--sync)' }}
          role="img"
          aria-label="Saving"
        />
      )}
    </button>
  );
}

export function SkeletonDay({ label, count = 6 }: { label: string; count?: number }) {
  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-label={label}>
      <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{label}</h2>
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="min-h-[5.5rem]" />
        ))}
      </div>
    </section>
  );
}

export default function DaySection({ date, label, payload, queue, onOpen, onFill, only, primary = false }: Props) {
  const day = payload.days[date];
  if (!day) return <SkeletonDay label={label} count={3} />;

  const status = dayStatus(day, payload.ctx, { only });
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
        return day.logs.length === 0 ? '' : `${habitsDone}/${activeIds.length}`;
      case 'weight':
        return day.weight === null ? '' : String(day.weight);
      case 'sidequests':
        return day.sidequestLogIds.length ? `${day.sidequestLogIds.length}/${questsCount}` : '';
      case 'hours':
        return hoursSet === 0 ? '' : status.items.find((i) => i.key === 'hours')?.filled ? '24 h' : `${hoursSet}/24 h`;
      case 'highlight':
        return day.highlight.trim();
      default:
        return '';
    }
  }

  const complete = status.total > 0 && missing === 0;

  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-label={label}>
      <h2 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>
        {label}
        <span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>{weekday}</span>
        <span className="ml-auto">
          <Chip tone={complete ? 'ok' : 'neutral'}>
            {status.filled}/{status.total}
          </Chip>
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {status.items
          .filter((i) => i.shown)
          .map((i) => {
            if (i.key === 'climb') {
              return (
                <div
                  key="climb"
                  className={`${TILE} border`}
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  <span className={LABEL} style={{ color: 'var(--text-3)' }}>
                    Climb
                    <Check size={14} aria-hidden="true" style={{ color: 'var(--ok)' }} />
                  </span>
                  <span className="num pr-9 text-[22px] font-semibold leading-none" style={{ color: 'var(--text-1)' }}>
                    {day.climbs}{' '}
                    <span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>
                      {day.climbs === 1 ? 'send' : 'sends'}
                    </span>
                  </span>
                  <Link
                    href="/climbing?tab=log"
                    aria-label="Add a climb"
                    className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </Link>
                </div>
              );
            }
            const items = itemsForTile(queue, i.key, date);
            return (
              <Tile
                key={i.key}
                name={NAMES[i.key]}
                prompt={PROMPTS[i.key]}
                value={valueOf(i.key)}
                big={i.key !== 'highlight'}
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
        <Button variant={primary ? 'primary' : 'outline'} onClick={() => onFill?.(date)} className="w-full font-semibold">
          Fill {missing} missing
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      ) : (
        complete && (
          <p className="flex items-center justify-center gap-1.5 text-[14px] font-medium" style={{ color: 'var(--reward-text)' }}>
            <Check size={16} aria-hidden="true" />
            Day complete
          </p>
        )
      )}
    </section>
  );
}
