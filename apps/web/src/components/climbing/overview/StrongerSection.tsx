"use client";

import { Card } from '@/components/ui/Card';
import { frenchToIndex, vScaleToNumber } from '@/lib/climbing';
import { flashGrade, gradePyramid, hardestByMonth, hardestSend, type ClimbType, type Log } from '@/lib/climbStats';
import Answer from './Answer';
import { QUESTION_CLASS, type DetailKind } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rankOf = (type: ClimbType, grade: string) => (type === 'boulder' ? vScaleToNumber(grade) : frenchToIndex(grade));

/** Section 1: am I getting stronger? `logs` are the logs of the shown year. */
export default function StrongerSection({ logs, year, onOpen }: { logs: Log[]; year: number; onOpen: (kind: DetailKind) => void }) {
  const types = (['boulder', 'rope'] as const).filter((t) => logs.some((l) => l.type === t && rankOf(t, l.grade) != null));
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Am I getting stronger?</h3>
        <button type="button" className="press ml-auto flex min-h-11 items-center rounded-[10px] px-2 text-[14px] font-medium" style={{ color: 'var(--accent)' }} onClick={() => onOpen('stronger')}>Details ›</button>
      </div>
      {types.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No graded climbs in {year} yet.</p>
      ) : (
        <div className="space-y-5">
          {types.map((t) => <TypeBlock key={t} type={t} logs={logs} year={year} label={types.length > 1 ? (t === 'boulder' ? 'Boulder' : 'Rope') : null} />)}
        </div>
      )}
    </Card>
  );
}

function TypeBlock({ type, logs, year, label }: { type: ClimbType; logs: Log[]; year: number; label: string | null }) {
  const flash = flashGrade(logs, type);
  const top = hardestSend(logs, type);
  const months = hardestByMonth(logs, year, type);
  const ranks = months.map((m) => (m.grade ? rankOf(type, m.grade) : null));
  const known = ranks.filter((r): r is number => r != null);
  const lo = known.length ? Math.min(...known) : 0;
  const hi = known.length ? Math.max(...known) : 0;
  // Bars start at a floor so the easiest month is still visible.
  const height = (r: number) => (hi === lo ? 80 : 30 + ((r - lo) / (hi - lo)) * 50);
  const pyramid = gradePyramid(logs, type).slice(0, 5);
  const maxCount = Math.max(1, ...pyramid.map((p) => p.count));
  const topMonth = top ? MONTHS[parseInt(top.date.slice(5, 7), 10) - 1] : '';
  const summary = months.filter((m) => m.grade).map((m) => `${MONTHS[m.month - 1]} ${m.grade}`).join(', ');
  return (
    <div>
      {label ? <div className="mb-1 text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>{label}</div> : null}
      <Answer
        parts={[
          ...(flash ? [<>Flash grade <span className="num">{flash}</span></>] : []),
          <>hardest <span className="num">{top?.grade}</span></>,
          <>since {topMonth}</>,
        ]}
      />
      <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label={`Hardest ${type} each month in ${year}: ${summary}`}>
        {months.map((m, i) => {
          const r = ranks[i];
          return (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="num mb-0.5 text-[10px] leading-none" style={{ color: 'var(--text-2)' }}>{m.grade ?? ''}</span>
              <div className="w-full rounded-t-[4px]" style={{ height: r == null ? 2 : `${height(r) * 0.7}px`, background: r == null ? 'var(--border)' : 'var(--accent)' }} />
              <span className="mt-1 text-[10px] leading-none" style={{ color: 'var(--text-3)' }}>{MONTHS[i][0]}</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-3 space-y-1" aria-label={`Hardest 5 ${type} grades in ${year}`}>
        {pyramid.map((p) => (
          <li key={p.grade} className="flex items-center gap-2 text-[13px]">
            <span className="num w-9 shrink-0 font-medium" style={{ color: 'var(--text-1)' }}>{p.grade}</span>
            <span className="min-w-0 flex-1">
              <span className="block h-2 rounded-full" style={{ width: `${Math.max(4, (p.count / maxCount) * 100)}%`, background: 'var(--accent)' }} />
            </span>
            <span className="num w-7 shrink-0 text-right" style={{ color: 'var(--text-2)' }}>{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
