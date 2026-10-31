"use client";

import type { ReactNode } from 'react';
import Sheet from '@/components/ui/Sheet';
import { frenchToIndex, vScaleToNumber } from '@journaling/core/climbing';
import { byGym, daysSince, firstSends, gradePyramid, gradeTable, sessionRecords, sessionsCount, weekdayCounts, yearOverYear, type ClimbType, type Log } from '@journaling/core/climbStats';
import { localISO, parseLocalDate } from '@journaling/core/date';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const rankOf = (type: ClimbType, grade: string) => (type === 'boulder' ? vScaleToNumber(grade) : frenchToIndex(grade));

/** "2026-03-12" -> "12 Mar 2026" */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map((x) => parseInt(x, 10));
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type Base = { open: boolean; onClose: () => void };

const H = 'mb-2 text-[12px] font-medium uppercase tracking-[0.04em]';
const Empty = ({ children }: { children: ReactNode }) => <p className="py-4 text-[14px]" style={{ color: 'var(--text-2)' }}>{children}</p>;
const Head = ({ children }: { children: ReactNode }) => <h3 className={H} style={{ color: 'var(--text-3)' }}>{children}</h3>;

function BarRow({ label, count, max, wide }: { label: string; count: number; max: number; wide?: boolean }) {
  return (
    <li className="flex min-h-8 items-center gap-2 text-[14px]">
      <span className={`${wide ? 'w-24 truncate' : 'num w-10'} shrink-0 font-medium`} style={{ color: 'var(--text-1)' }}>{label}</span>
      <span className="min-w-0 flex-1">
        <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(count > 0 ? 4 : 0, (count / Math.max(1, max)) * 100)}%`, background: 'var(--accent)' }} />
      </span>
      <span className="num w-9 shrink-0 text-right" style={{ color: 'var(--text-2)' }}>{count}</span>
    </li>
  );
}

export function StrongerSheet({ open, onClose, allLogs, yearLogs, year }: Base & { allLogs: Log[]; yearLogs: Log[]; year: number }) {
  const types = (['boulder', 'rope'] as const).filter((t) => yearLogs.some((l) => l.type === t && rankOf(t, l.grade) != null));
  return (
    <Sheet open={open} onClose={onClose} title="Am I getting stronger?" subtitle={String(year)} initialFocus="panel">
      {types.length === 0 ? (
        <Empty>No graded climbs in {year} yet.</Empty>
      ) : (
        <div className="space-y-6 pb-2">
          {types.map((t) => {
            const pyramid = gradePyramid(yearLogs, t);
            const max = Math.max(1, ...pyramid.map((p) => p.count));
            const table = gradeTable(yearLogs, t);
            const firsts = firstSends(allLogs, t).filter((f) => f.date.startsWith(`${year}-`) && rankOf(t, f.grade) != null);
            const name = t === 'boulder' ? 'Boulder' : 'Rope';
            return (
              <section key={t} aria-label={name}>
                {types.length > 1 ? <div className="mb-2 text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{name}</div> : null}
                <Head>Sends by grade</Head>
                <ul>{pyramid.map((p) => <BarRow key={p.grade} label={p.grade} count={p.count} max={max} />)}</ul>
                <div className="mt-4"><Head>Grade table</Head></div>
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px]" style={{ color: 'var(--text-3)' }}>
                      <th className="py-1 font-medium">Grade</th>
                      <th className="py-1 text-right font-medium">Sends</th>
                      <th className="py-1 text-right font-medium">Flash</th>
                      <th className="py-1 text-right font-medium">Avg falls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((r) => (
                      <tr key={r.grade} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="num py-1.5 font-medium" style={{ color: 'var(--text-1)' }}>{r.grade}</td>
                        <td className="num py-1.5 text-right" style={{ color: 'var(--text-2)' }}>{r.sends}</td>
                        <td className="num py-1.5 text-right" style={{ color: 'var(--text-2)' }}>{r.flashPct}%</td>
                        <td className="num py-1.5 text-right" style={{ color: 'var(--text-2)' }}>{r.avgFalls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4"><Head>Firsts</Head></div>
                {firsts.length === 0 ? (
                  <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>No new grades in {year}.</p>
                ) : (
                  <ul className="space-y-1">
                    {firsts.map((f) => (
                      <li key={f.grade} className="text-[14px]" style={{ color: 'var(--text-1)' }}>
                        First <span className="num font-medium">{f.grade}</span> · <span className="num">{fmtDate(f.date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

export function HabitsSheet({ open, onClose, allLogs, yearLogs, year, today }: Base & { allLogs: Log[]; yearLogs: Log[]; year: number; today: string }) {
  const since = daysSince(allLogs, today);
  const counts = weekdayCounts(yearLogs);
  const max = Math.max(1, ...counts);
  const rec = sessionRecords(yearLogs);
  const from = parseLocalDate(today);
  from.setDate(from.getDate() - 29);
  const fromISO = localISO(from);
  const last30 = sessionsCount(allLogs.filter((l) => l.date.slice(0, 10) >= fromISO && l.date.slice(0, 10) <= today));
  const sinceText = since == null ? null : since === 0 ? 'today' : since === 1 ? '1 day ago' : `${since} days ago`;
  return (
    <Sheet open={open} onClose={onClose} title="Am I climbing enough?" subtitle={String(year)} initialFocus="panel">
      {allLogs.length === 0 ? (
        <Empty>No sessions yet. Your first one will show up here.</Empty>
      ) : (
        <div className="space-y-6 pb-2">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[12px]" style={{ color: 'var(--text-3)' }}>Last session</dt>
              <dd className="num text-[18px] font-medium" style={{ color: 'var(--text-1)' }}>{sinceText}</dd>
            </div>
            <div>
              <dt className="text-[12px]" style={{ color: 'var(--text-3)' }}>Sessions, last 30 days</dt>
              <dd className="num text-[18px] font-medium" style={{ color: 'var(--text-1)' }}>{last30}</dd>
            </div>
          </dl>
          {yearLogs.length === 0 ? (
            <Empty>No climbs logged in {year}.</Empty>
          ) : (
            <>
              <section>
                <Head>Sessions by weekday</Head>
                <ul aria-label={`Sessions per weekday in ${year}`}>
                  {counts.map((c, i) => <BarRow key={WEEKDAYS[i]} label={WEEKDAYS[i]} count={c} max={max} />)}
                </ul>
              </section>
              <section>
                <Head>Sends per session</Head>
                <p className="text-[14px]" style={{ color: 'var(--text-1)' }}>
                  Average <span className="num font-medium">{rec.avgSends}</span> · most <span className="num font-medium">{rec.most}</span>
                  {rec.mostDate ? <> on <span className="num">{fmtDate(rec.mostDate)}</span></> : null}
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function CompareSheet({ open, onClose, allLogs, year, asOf }: Base & { allLogs: Log[]; year: number; asOf: string }) {
  const { thisYear, lastYear } = yearOverYear(allLogs, asOf);
  const lastEmpty = lastYear.sends === 0;
  const rows: Array<[string, string, string]> = [
    ['Sends', String(thisYear.sends), String(lastYear.sends)],
    ['Sessions', String(thisYear.sessions), String(lastYear.sessions)],
    ['Best', thisYear.best ?? '-', lastYear.best ?? '-'],
  ];
  return (
    <Sheet open={open} onClose={onClose} title="This year vs last" subtitle={`Up to ${fmtDate(asOf)}`} initialFocus="panel">
      {lastEmpty && thisYear.sends === 0 ? (
        <Empty>No climbs logged in {year} or {year - 1} yet.</Empty>
      ) : (
        <div className="pb-2">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-right text-[12px]" style={{ color: 'var(--text-3)' }}>
                <th className="py-1" />
                <th className="py-1 font-medium">{year} so far</th>
                <th className="py-1 font-medium">{year - 1} same date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, a, b]) => (
                <tr key={name} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <th className="py-2 text-left font-medium" style={{ color: 'var(--text-2)' }}>{name}</th>
                  <td className="num py-2 text-right text-[16px] font-medium" style={{ color: 'var(--text-1)' }}>{a}</td>
                  <td className="num py-2 text-right text-[16px]" style={{ color: 'var(--text-2)' }}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastEmpty ? <p className="mt-3 text-[14px]" style={{ color: 'var(--text-2)' }}>No climbs logged in {year - 1}.</p> : null}
        </div>
      )}
    </Sheet>
  );
}

export function GymsSheet({ open, onClose, yearLogs, year }: Base & { yearLogs: Log[]; year: number }) {
  const gyms = byGym(yearLogs);
  const max = Math.max(1, ...gyms.map((g) => g.count));
  return (
    <Sheet open={open} onClose={onClose} title="Gyms" subtitle={String(year)} initialFocus="panel">
      {gyms.length === 0 ? (
        <Empty>No climbs logged in {year} yet.</Empty>
      ) : (
        <ul aria-label={`Sends per gym in ${year}`} className="pb-2">
          {gyms.map((g) => <BarRow key={g.gym} label={g.gym} count={g.count} max={max} wide />)}
        </ul>
      )}
    </Sheet>
  );
}
