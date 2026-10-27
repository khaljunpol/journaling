'use client';

import Button from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { groupBySession } from '@/lib/climbStats';
import { dayLabel, fallsLabel, type LogEntry } from './types';

const label = 'text-[12px] font-medium uppercase tracking-[0.04em]';

function ClimbChip({ log, onEdit }: { log: LogEntry; onEdit: (l: LogEntry) => void }) {
  const flash = log.attempts === 0;
  return (
    <button
      type="button"
      aria-label={`Edit ${log.grade}, ${fallsLabel(log.attempts)}`}
      onClick={() => onEdit(log)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] hover:brightness-110"
      style={{ background: 'var(--surface-2)' }}
    >
      <span className="num font-semibold" style={{ color: 'var(--text-1)' }}>{log.grade}</span>
      <span className="num" style={{ color: flash ? 'var(--ok)' : 'var(--text-2)' }}>{fallsLabel(log.attempts)}</span>
    </button>
  );
}

/** Sessions of one day: header "S1 · 4 sends", then the climbs as chips. */
function Sessions({ logs, onEdit }: { logs: LogEntry[]; onEdit: (l: LogEntry) => void }) {
  const byId = new Map(logs.map((l) => [l.id, l]));
  const sessions = groupBySession(logs).flatMap((g) => g.sessions);
  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div key={s.session}>
          <div className={`${label} mb-1`} style={{ color: 'var(--text-3)' }}>S{s.session} · {s.logs.length} send{s.logs.length === 1 ? '' : 's'}</div>
          <div className="flex flex-wrap gap-2">
            {s.logs.map((l) => <ClimbChip key={l.id} log={byId.get(l.id) ?? (l as LogEntry)} onEdit={onEdit} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodayList({ date, today, logs, onEdit, onShareDay }: {
  date: string; today: string; logs: LogEntry[];
  onEdit: (l: LogEntry) => void; onShareDay: (d: string) => void;
}) {
  return (
    <Card>
      <CardHeader
        title={`${date === today ? 'Today' : dayLabel(date)} · ${logs.length} send${logs.length === 1 ? '' : 's'}`}
        actions={<Button small variant="outline" onClick={() => onShareDay(date)}>Share story</Button>}
      />
      {logs.length === 0
        ? <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No climbs yet. Tap an outcome above to log one.</p>
        : <Sessions logs={logs} onEdit={onEdit} />}
    </Card>
  );
}

export function AllLogs({ items, total, page, limit, loading, onPrev, onNext, onEdit, onShareDay }: {
  items: LogEntry[]; total: number; page: number; limit: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
  onEdit: (l: LogEntry) => void; onShareDay: (d: string) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(total / limit));
  const days = groupBySession(items).map((g) => ({ date: g.date, logs: items.filter((l) => l.date.slice(0, 10) === g.date) }));
  return (
    <Card>
      <CardHeader title="All logs" meta={<span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{total} total</span>} />
      {days.length === 0 && <p className="py-6 text-center text-[14px]" style={{ color: 'var(--text-2)' }}>{loading ? 'Loading…' : 'No logs found'}</p>}
      <div className="space-y-4">
        {days.map((d) => (
          <section key={d.date} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>{dayLabel(d.date)}</h4>
              <Button small variant="outline" onClick={() => onShareDay(d.date)}>Share story</Button>
            </div>
            <Sessions logs={d.logs} onEdit={onEdit} />
          </section>
        ))}
      </div>
      {total > limit && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1 || loading} onClick={onPrev}>Newer</Button>
          <span className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{page} / {maxPage}</span>
          <Button variant="outline" disabled={page >= maxPage || loading} onClick={onNext}>Older</Button>
        </div>
      )}
    </Card>
  );
}
