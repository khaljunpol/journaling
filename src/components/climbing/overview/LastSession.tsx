"use client";

import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { newBest, hardestSend, type Log } from '@/lib/climbStats';
import { latestSessionDate } from '@/lib/climbStory';
import { dayLabel } from '@/components/climbing/types';
import Answer from './Answer';
import { QUESTION_CLASS } from './types';

/** Section 0: the newest day with a log, in one line, with a New best moment when it earned one. */
export default function LastSession({ logs, onShare }: { logs: Log[]; onShare: (date: string) => void }) {
  const date = latestSessionDate(logs);
  if (!date) return null;
  const day = logs.filter((l) => l.date.slice(0, 10) === date);
  const flashes = day.filter((l) => l.attempts === 0).length;
  const best = (['boulder', 'rope'] as const).map((t) => hardestSend(day, t)?.grade).filter(Boolean).join(' · ');
  const record = newBest(logs, date);
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className={QUESTION_CLASS} style={{ color: 'var(--text-3)' }}>Last session · {dayLabel(date)}</div>
          <Answer
            className="mt-1"
            parts={[
              <><span className="num">{day.length}</span> {day.length === 1 ? 'send' : 'sends'}</>,
              <><span className="num">{flashes}</span> flash</>,
              ...(best ? [<>best <span className="num">{best}</span></>] : []),
            ]}
          />
          {record ? (
            <p className="num mt-1 text-[14px] font-semibold" style={{ color: 'var(--reward-text)' }}>New best: {record}</p>
          ) : null}
        </div>
        <Button small variant="outline" onClick={() => onShare(date)}>Share story</Button>
      </div>
    </Card>
  );
}
