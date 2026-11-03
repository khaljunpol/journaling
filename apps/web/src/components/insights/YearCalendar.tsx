'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCache, setCache } from '@/lib/cache';
import Heatmap from '@/components/overview/Heatmap';
import { Card, CardHeader } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Skeleton from '@/components/ui/Skeleton';
import { layerCell, type DayTuple, type Layer } from '@journaling/core/yearDays';
import LayerControl, { useLayer } from './LayerControl';
import MonthSheet, { DayStrip, MONTH_NAMES, monthDates, type Cell } from './MonthSheet';

type YearData = { year: number; days: Record<string, DayTuple>; summary: { logged: number; bestMonth: number | null } };

const LEGEND: Partial<Record<Layer, { color: string; steps: string[] }>> = {
  habits: { color: 'var(--accent)', steps: ['Some', 'Half', 'Most', 'All'] },
  sleep: { color: '#38BDF8', steps: ['<6h', '6–7h', '7–8h', '8h+'] },
  points: { color: 'var(--accent)', steps: ['Some', 'More', 'Most', 'Max'] },
};

/** Draws `year:{year}` from cache first, then swaps in the fresh read. */
function useYear(year: number): { data: YearData | null; failed: boolean } {
  const [state, setState] = useState<{ year: number; data: YearData | null; failed: boolean }>({ year, data: null, failed: false });
  useEffect(() => {
    const ctrl = new AbortController();
    const key = `year:${year}`;
    const cached = getCache<YearData>(key)?.data ?? null;
    setState({ year, data: cached, failed: false });
    fetch(`/api/year?year=${year}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('read failed'))))
      .then((d: YearData) => {
        setState({ year, data: d, failed: false });
        try { setCache(key, d); } catch { /* cache is optional */ }
      })
      .catch(() => { if (!ctrl.signal.aborted) setState((s) => ({ ...s, failed: s.data === null })); });
    return () => ctrl.abort();
  }, [year]);
  return state.year === year ? { data: state.data, failed: state.failed } : { data: null, failed: false };
}

/** The year as one calendar with switchable layers. Desktop: the 53-week grid. Phone: 12 small months, a tap opens one. */
export default function YearCalendar({ today }: { today: string }) {
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const { data, failed } = useYear(year);

  const hasSleep = useMemo(() => Object.values(data?.days ?? {}).some((t) => t[2] !== null), [data]);
  const hasPoints = useMemo(() => Object.values(data?.days ?? {}).some((t) => (t[3] ?? 0) > 0), [data]);
  const layers: Layer[] = ['mood', 'habits', ...(hasSleep ? (['sleep'] as const) : []), ...(hasPoints ? (['points'] as const) : [])];
  const layer = useLayer(layers);
  const values = useMemo(() => {
    const out: Record<string, Cell> = {};
    for (const [d, t] of Object.entries(data?.days ?? {})) {
      const c = layerCell(layer, d, t);
      if (c) out[d] = c;
    }
    return out;
  }, [data, layer]);

  const years = Array.from({ length: 5 }, (_, i) => thisYear - 4 + i);
  const legend = LEGEND[layer];
  const what = layer === 'mood' ? 'Mood' : layer === 'habits' ? 'Habits' : layer === 'points' ? 'Points' : 'Sleep';
  const { logged = 0, bestMonth = null } = data?.summary ?? {};

  return (
    <Card as="section">
      <CardHeader
        title={`${year}`}
        meta={data ? (
          <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            <span className="num font-semibold" style={{ color: 'var(--text-1)' }}>{logged}</span> days logged
            {bestMonth !== null ? <> · best month <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{MONTH_NAMES[bestMonth]}</span></> : null}
          </span>
        ) : null}
        actions={
          <Select aria-label="Year" value={year} onChange={(e) => { setYear(Number(e.target.value)); setSelected(null); }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <LayerControl layers={layers} value={layer} />
        {legend ? (
          <ul className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }} aria-label={`${what} key`}>
            {legend.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: `color-mix(in srgb, ${legend.color} ${25 * (i + 1)}%, var(--surface-3))` }} />
                {s}
              </li>
            ))}
            {layer === 'points' ? (
              <li className="flex items-center gap-1">
                <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: 'var(--reward)' }} />
                Perfect
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {data === null ? (
        failed ? (
          <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>Couldn&apos;t load {year}. Try again later.</p>
        ) : (
          <>
            <Skeleton className="hidden h-[106px] w-full sm:block" />
            <Skeleton className="h-[420px] w-full sm:hidden" />
          </>
        )
      ) : (
        <>
          <div className="hidden sm:block">
            <Heatmap year={year} values={values} what={what} today={today} selected={selected} onSelect={setSelected} />
            <DayStrip date={selected} cell={selected ? values[selected] ?? null : null} today={today} />
          </div>
          <ol className="grid grid-cols-3 gap-x-3 gap-y-4 sm:hidden" aria-label={`${what} by month in ${year}`}>
            {MONTH_NAMES.map((name, m) => {
              const dates = monthDates(year, m);
              const n = dates.filter((d) => values[d.date]).length;
              const rows = Math.max(...dates.map((d) => d.row)) + 1;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setMonth(m)}
                    aria-label={`${name}, ${n} ${n === 1 ? 'day' : 'days'} with data`}
                    className="press w-full rounded-[10px] p-1 text-left"
                  >
                    <span className="mb-1 block text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{name.slice(0, 3)}</span>
                    <svg viewBox={`0 0 ${7 * 13 - 3} ${rows * 13 - 3}`} className="h-auto w-full" aria-hidden="true">
                      {dates.map((d) => (
                        <rect
                          key={d.date}
                          x={d.col * 13}
                          y={d.row * 13}
                          width={10}
                          height={10}
                          rx={2}
                          fill={values[d.date]?.color ?? 'var(--surface-3)'}
                          opacity={d.date > today ? 0.35 : 1}
                        />
                      ))}
                    </svg>
                  </button>
                </li>
              );
            })}
          </ol>
          <MonthSheet year={year} month={month} values={values} today={today} onClose={() => setMonth(null)} />
        </>
      )}
    </Card>
  );
}
