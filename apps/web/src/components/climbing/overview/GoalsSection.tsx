'use client';

import { Plus } from 'lucide-react';
import type { GoalPace } from '@journaling/core/climbStats';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Answer from './Answer';
import { QUESTION_CLASS } from './types';

export type GoalRow = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number; done: number; pct: number; pace: GoalPace };

/** "Am I on track?": one answer line, then a bar per goal. A tap opens that goal. */
export default function GoalsSection({ goals, summary, onAdd, onOpen }: {
  goals: GoalRow[];
  summary: string;
  onAdd: () => void;
  onOpen: (g: GoalRow) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Am I on track?</h3>
        <Button small variant="outline" className="ml-auto" onClick={onAdd}><Plus size={16} aria-hidden="true" />Goal</Button>
      </div>
      <Answer className="mb-3" parts={[summary.split(/(\d+)/).map((t, i) => (i % 2 ? <span key={i} className="num">{t}</span> : t))]} />
      {goals.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {goals.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="press block min-h-11 w-full rounded-[10px] p-3 text-left hover-fine:brightness-110"
                style={{ background: 'var(--surface-2)' }}
                onClick={() => onOpen(g)}
                aria-label={`${g.grade} ${g.type} goal, ${g.done} of ${g.target}. Open details`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Chip tone="accent">{g.type}</Chip>
                    <span className="num text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{g.grade}</span>
                  </div>
                  <span className="num text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>
                    {g.done}<span className="text-[13px] font-normal" style={{ color: 'var(--text-2)' }}>/{g.target}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <div className="bar-x h-2 w-full rounded-full" style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, g.pct))}%)`, background: g.done >= g.target ? 'var(--reward)' : 'var(--accent)' }} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  <span className="num" style={g.done >= g.target ? { color: 'var(--reward-text)' } : undefined}>{g.pct}%</span>
                  <GoalPaceLine pace={g.pace} done={g.done >= g.target} year={g.year} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function GoalPaceLine({ pace, done, year }: { pace: GoalPace; done: boolean; year: number }) {
  if (done) return <span className="text-[13px] font-medium" style={{ color: 'var(--reward-text)' }}>Done</span>;
  if (pace.ended) return <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>Ended · {pace.done}/{pace.target}</span>;
  if (pace.notStarted) return <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>Starts {year} · {pace.neededPerWeek}/wk</span>;
  return (
    <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>
      {pace.neededPerWeek}/wk needed · {pace.onTrack ? 'on track' : 'behind pace'}
    </span>
  );
}
