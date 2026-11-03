'use client';

import { doneGoodHabits, goodIds } from '@journaling/core/habitCategory';
import { useEffect, useState } from 'react';
import { usualList } from '@journaling/core/scoring';
import Confetti from '@/components/game/Confetti';
import { firstPerfect, useReward } from '@/components/game/rewardBus';
import {
  Beer, BicepsFlexed, Bike, BookOpen, Brain, Check, ChevronRight, Cigarette, Coffee, Dumbbell, Flame, Footprints, Gamepad2,
  GlassWater, Heart, Milk, Mountain, Music, PenLine, PersonStanding, Pill, Waves, Wine, type LucideProps,
} from 'lucide-react';
import { dayStatus, missingInOrder, type ItemKey } from '@journaling/core/quickDay';
import { itemsForTile } from '@journaling/core/quickApply';
import { moodEmoji } from '@journaling/core/mood';
import type { HabitIcon } from '@journaling/core/habitIcons';
import { parseLocalDate } from '@journaling/core/date';
import type { QuickPayload } from '@journaling/core/quickPayload';
import type { OutboxItem } from '@/lib/outbox';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import Ring from '@/components/overview/Ring';

const NAMES: Record<ItemKey, string> = {
  mood: 'Mood',
  habits: 'Habits',
  weight: 'Weight',
  sidequests: 'Quests',
  hours: 'Hours',
  highlight: 'Highlight',
  climb: 'Climb',
};

/** Lucide has no racket, so this one is drawn in the same 24px, 2px-stroke style. */
function Racket(props: LucideProps) {
  const { size = 24, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <ellipse cx="14.5" cy="9.5" rx="5.5" ry="6.5" transform="rotate(45 14.5 9.5)" />
      <path d="M10.5 13.5 4 20" />
      <circle cx="19" cy="19" r="1.5" />
    </svg>
  );
}

const HABIT_ICONS: Record<HabitIcon, (p: LucideProps) => React.ReactNode> = {
  gym: Dumbbell,
  hiit: Flame,
  bodyweight: BicepsFlexed,
  racket: Racket,
  climb: Mountain,
  run: Footprints,
  swim: Waves,
  bike: Bike,
  yoga: PersonStanding,
  beer: Beer,
  wine: Wine,
  smoke: Cigarette,
  coffee: Coffee,
  water: GlassWater,
  shake: Milk,
  pill: Pill,
  read: BookOpen,
  meditate: Brain,
  music: Music,
  write: PenLine,
  games: Gamepad2,
  heart: Heart,
};

type DoneHabit = { id: string; label: string; icon: HabitIcon | null };
const MAX_CHIPS = 4;

/** What was done, readable without opening the editor: an icon when the name gives one, else just the name. */
function HabitChips({ habits }: { habits: DoneHabit[] }) {
  const shown = habits.slice(0, MAX_CHIPS);
  const more = habits.length - shown.length;
  return (
    <span className="flex w-full flex-wrap items-center gap-1.5" aria-hidden="true">
      {shown.map((h) => {
        const Icon = h.icon ? HABIT_ICONS[h.icon] : null;
        return (
          <span
            key={h.id}
            className="inline-flex h-7 max-w-[9rem] items-center gap-1 rounded-full px-2.5 text-[13px] font-medium"
            style={{ background: 'var(--surface-3)', color: 'var(--text-1)' }}
          >
            {Icon && <Icon size={14} style={{ color: 'var(--accent)' }} className="shrink-0" />}
            <span className="truncate">{h.label}</span>
          </span>
        );
      })}
      {more > 0 && (
        <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>+{more}</span>
      )}
    </span>
  );
}

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
  /** Opens the climbing quick log for this date. */
  onClimb?: (date: string) => void;
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
  /** Habits tile only: done habits, shown as chips on a 2-slot-wide tile. */
  chips?: DoneHabit[];
  /** Habits tile only: points the last Done added, shown for 900ms. Never blocks a tap. */
  burst?: { key: number; points: number } | null;
}) {
  const { name, prompt, value, big, filled, counts, pending, failed, onClick, chips, burst } = props;
  const withChips = !failed && !!chips && chips.length > 0;
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
      aria-label={`${name}: ${value || (filled ? 'done' : 'empty')}${withChips ? ` (${chips.map((h) => h.label).join(', ')})` : ''}${pending ? ', saving' : ''}${failed ? ", didn't save" : ''}`}
      className={`${TILE} ${chips ? 'col-span-2' : ''} ${pop ? 'quick-pop' : ''}`}
      style={{ background: filled ? 'var(--surface-2)' : 'transparent', border: `1px ${border}` }}
    >
      <span className={LABEL} style={{ color: 'var(--text-3)' }}>
        {name}
        {withChips && value && (
          <span className="num ml-auto text-[13px] normal-case tracking-normal" style={{ color: 'var(--text-2)' }}>{value}</span>
        )}
        {filled && !failed && <Check size={14} aria-hidden="true" style={{ color: 'var(--ok)' }} />}
      </span>
      {withChips ? (
        <HabitChips habits={chips} />
      ) : failed ? (
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
      {burst && burst.points > 0 ? (
        <span key={burst.key} aria-hidden="true" className="points-burst num pointer-events-none absolute bottom-2.5 right-3 text-[15px] font-semibold" style={{ color: 'var(--reward-text)' }}>
          +{burst.points}
        </span>
      ) : null}
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

export default function DaySection({ date, label, payload, queue, onOpen, onFill, onClimb, only, primary = false }: Props) {
  const day = payload.days[date];
  const reward = useReward(date);
  const [confetti, setConfetti] = useState<{ key: number } | null>(null);
  useEffect(() => {
    if (!reward?.perfect || !firstPerfect(date)) return;
    navigator.vibrate?.(10);
    setConfetti({ key: reward.key });
  }, [reward, date]);
  // Its own timer: the reward clears itself at 900ms, which must not cancel this one.
  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(null), 1400);
    return () => clearTimeout(t);
  }, [confetti]);
  if (!day) return <SkeletonDay label={label} count={3} />;

  const status = dayStatus(day, payload.ctx, { only });
  const missing = missingInOrder(status).length;
  const weekday = parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });
  const good = goodIds(payload.ctx.activities);
  // "4 of 6": done habits on the day's usual list (all good habits without one). Off-list ticks still earn points.
  const usual = usualList(date, payload.habitTemplates ?? { weekday: null, weekend: null }, payload.ctx.activities);
  const usualDone = usual.filter((id) => day.logs.some((l) => l.completed && l.activityId === id)).length;
  const questsCount = payload.ctx.sidequests.filter(
    (q) => (q.type === 'count' || q.type === 'timed') && !q.completedAt && q.year === payload.ctx.year,
  ).length;
  const hoursSet = day.hours.filter((h) => h !== null).length;

  function valueOf(key: ItemKey): string {
    switch (key) {
      case 'mood':
        return day.mood === null ? '' : `${moodEmoji(day.mood)} ${day.mood}`;
      case 'habits':
        return day.logs.length === 0 || good.size === 0 || usual.length === 0 ? '' : `${usualDone} of ${usual.length}`;
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
  const done = doneGoodHabits(day.logs, payload.ctx.activities, day.climbs);

  return (
    <section className="card space-y-3 p-4 sm:p-5" aria-label={label}>
      {confetti ? <Confetti key={confetti.key} points={25} /> : null}
      {reward && reward.points > 0 ? <span className="sr-only" role="status">{`+${reward.points} points${reward.perfect ? ', perfect day' : ''}`}</span> : null}
      <h2 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>
        {label}
        <span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>{weekday}</span>
        <span className="ml-auto flex items-center gap-2">
          {primary && <Ring filled={status.filled} total={status.total} size={22} />}
          <Chip tone={complete ? 'ok' : 'neutral'}>
            {status.filled}/{status.total}
          </Chip>
        </span>
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {status.items
          .filter((i) => i.shown && i.key !== 'climb') // climbs show as a chip on the habits tile
          .map((i) => {
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
                chips={i.key === 'habits' ? done : undefined}
                burst={i.key === 'habits' && reward ? { key: reward.key, points: reward.points } : null}
              />
            );
          })}
        {onClimb ? (
          <Tile
            name="Climb"
            prompt="Log"
            value={day.climbs > 0 ? String(day.climbs) : ''}
            big
            filled={day.climbs > 0}
            counts={false}
            pending={false}
            failed={false}
            onClick={() => onClimb(date)}
          />
        ) : null}
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
