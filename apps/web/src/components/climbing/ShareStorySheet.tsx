"use client";

import { Copy, Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input, { Label } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { buildClimbCard, buildOverlay, buildStory, dayGoals, buildYearStats, buildYearStory, chooseGoal, climbsOn, latestSessionDate, type StoryGoal, type StoryLog } from '@/lib/climbStory';
import { localTodayISO } from '@journaling/core/date';
import { canvasToBlob, renderClimbCard, renderOverlay, renderStory, renderYearStats, renderYearStory } from './storyImage';

type Props = {
  open: boolean;
  onClose: () => void;
  goals: StoryGoal[];
  /** Fix the starting goal (the goal overlay). Without it the goal follows the date. */
  initialGoalId?: string;
  /** Starting date. Without it the latest session of the goal's year is used. */
  initialDate?: string;
  /** Climbs already loaded by the page, by year. Missing years are read from /api/climbing/logs. */
  knownLogs?: Record<number, StoryLog[]>;
  /** Which image to start on. */
  initialStyle?: StoryStyle;
  /** Overlay of one climb (a log id) instead of the whole session. */
  initialClimbId?: string;
  /** Other ways to make an image (the older generators), shown small under the form. */
  moreStyles?: Array<{ label: string; run: () => void }>;
};

/** "Share story": pick a style, goal and date, see the image, then share it (phone) or download it. */
export default function ShareStorySheet({ open, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Share story" subtitle="For Instagram">
      <StoryBody {...rest} />
    </Sheet>
  );
}

const yearOf = (iso: string) => parseInt(iso.slice(0, 4), 10);
const goalLabel = (g: StoryGoal) => `${g.year} · ${g.type === 'boulder' ? g.grade.toUpperCase() : g.grade} ${g.type}`;
const MIN_YEAR = 2000;

type Shown = { url: string; key: string; blob: Blob };

export type StoryStyle = 'story' | 'overlay' | 'goals' | 'year';
type Style = StoryStyle;
const STYLES: Array<{ id: Style; label: string; hint: string }> = [
  { id: 'story', label: 'Story', hint: 'Full story, 1080 x 1920.' },
  { id: 'overlay', label: 'Overlay', hint: 'For on top of your video or photo. Copy it, then paste it in your story.' },
  { id: 'goals', label: 'Goals', hint: 'Every goal of the year, 1080 x 1920.' },
  { id: 'year', label: 'Year', hint: 'Your year in numbers, 1080 x 1920.' },
];

function StoryBody({ goals, initialGoalId, initialDate, knownLogs, initialStyle, initialClimbId, moreStyles }: Omit<Props, 'open' | 'onClose'>) {
  const today = useMemo(() => localTodayISO(), []);
  const maxYear = yearOf(today) + 1;
  const [goalId, setGoalId] = useState<string>(
    () => initialGoalId ?? (initialDate ? chooseGoal(goals, [], initialDate)?.id : undefined) ?? goals[0]?.id ?? '',
  );
  const [date, setDate] = useState<string>(initialDate ?? today);
  const [style, setStyle] = useState<Style>(initialStyle ?? 'story');
  const [clearBg, setClearBg] = useState(false);
  // Overlay content: 'session' or one climb's log id
  const [show, setShow] = useState<string>(initialClimbId ?? 'session');
  const [goalTouched, setGoalTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const [fetched, setFetched] = useState<Record<number, StoryLog[]>>({});
  const [failedYears, setFailedYears] = useState<number[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  const [note, setNote] = useState('');
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const requestedRef = useRef<Set<number>>(new Set());
  const runRef = useRef(0);
  // The blob URL currently on screen, so it can be revoked when replaced or on unmount.
  const urlRef = useRef<string | null>(null);
  function swapUrl(next: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
  }

  const goal = goals.find((g) => g.id === goalId) ?? null;
  const dateYear = yearOf(date);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && dateYear >= MIN_YEAR && dateYear <= maxYear;

  const years = useMemo(() => {
    const set = new Set<number>();
    if (goal) set.add(goal.year);
    if (dateValid) set.add(dateYear);
    return Array.from(set);
  }, [goal, dateYear, dateValid]);

  // Year logs: from the page when it has them, else one read-only fetch per year, once. No cleanup-cancel,
  // so a second year never cancels the first, and half-typed years never reach the server (see dateValid).
  useEffect(() => {
    for (const y of years) {
      if (knownLogs?.[y] || requestedRef.current.has(y)) continue;
      requestedRef.current.add(y);
      (async () => {
        try {
          const res = await fetch(`/api/climbing/logs?from=${y}-01-01&to=${y}-12-31`);
          const items = res.ok ? await res.json() : null;
          if (!Array.isArray(items)) throw new Error('bad');
          setFetched((prev) => ({ ...prev, [y]: items }));
          setFailedYears((prev) => prev.filter((x) => x !== y));
        } catch {
          requestedRef.current.delete(y); // allow a retry when the year is picked again
          setFailedYears((prev) => (prev.includes(y) ? prev : [...prev, y]));
        }
      })();
    }
  }, [years, knownLogs]);

  const allLogs = useMemo(() => {
    const out: StoryLog[] = [];
    for (const y of years) out.push(...(knownLogs?.[y] ?? fetched[y] ?? []));
    return out;
  }, [years, knownLogs, fetched]);
  const ready = years.every((y) => knownLogs?.[y] || fetched[y]);
  const failed = years.some((y) => failedYears.includes(y));

  // Smart defaults once the data is in, until the user changes a field.
  useEffect(() => {
    if (!ready) return;
    if (!dateTouched && !initialDate && goal) {
      const latest = latestSessionDate(allLogs.filter((l) => l.date.startsWith(`${goal.year}-`) && l.date.slice(0, 10) <= today));
      if (latest && latest !== date) { setDate(latest); return; }
    }
    if (!goalTouched && !initialGoalId && dateValid) {
      const pick = chooseGoal(goals, allLogs, date);
      if (pick && pick.id !== goalId) setGoalId(pick.id);
    }
  }, [ready, allLogs, goal, date, dateValid, dateTouched, goalTouched, initialDate, initialGoalId, goals, goalId, today]);

  // Share files only on touch devices; desktop gets a plain download.
  useEffect(() => {
    try {
      const probe = new File([''], 'a.png', { type: 'image/png' });
      const touch = window.matchMedia('(pointer: coarse)').matches;
      setCanShareFiles(touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
    } catch { setCanShareFiles(false); }
    setCanCopy(typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function');
  }, []);

  // What the image should show right now. The buttons only work when the shown image matches it.
  const dayClimbs = useMemo(() => climbsOn(allLogs, date), [allLogs, date]);
  // The story shows every goal sent that day; the goal picker is only for a day without one.
  const sentGoals = useMemo(() => dayGoals(goals, allLogs, date), [goals, allLogs, date]);
  const storyGoals = sentGoals.length ? sentGoals : goal ? [goal] : [];
  // A climb from another date falls back to the whole session.
  const climbId = style === 'overlay' && show !== 'session' && dayClimbs.some((x) => x.id === show) ? show : null;

  // The overlay card is always see-through; the full images can drop their background too.
  const seeThrough = style === 'overlay' || clearBg;
  const key = goal && dateValid && ready && !failed ? `${style}|${seeThrough}|${climbId}|${storyGoals.map((x) => x.id).join(',')}|${date}|${allLogs.length}` : null;

  useEffect(() => {
    if (!goal || !key) return;
    const run = ++runRef.current;
    (async () => {
      try {
        const canvas =
          style === 'overlay' && climbId ? await renderClimbCard(buildClimbCard(climbId, goals, allLogs) as NonNullable<ReturnType<typeof buildClimbCard>>)
          : style === 'overlay' ? await renderOverlay(buildOverlay(goals, allLogs, date))
          : style === 'goals' ? await renderYearStory(buildYearStory(goals, allLogs, date), { clear: seeThrough })
          : style === 'year' ? await renderYearStats(buildYearStats(allLogs, dateYear, date), { clear: seeThrough })
          : await renderStory(buildStory(storyGoals, allLogs, date), { clear: seeThrough });
        const blob = await canvasToBlob(canvas);
        if (run !== runRef.current) return;
        if (!blob) throw new Error('no blob');
        const url = URL.createObjectURL(blob);
        swapUrl(url);
        setShown({ url, key, blob });
        setNote('');
      } catch {
        if (run === runRef.current) { swapUrl(null); setShown(null); setNote('Could not draw the image. Try again.'); }
      }
    })();
  // allLogs, style and seeThrough are covered by key; only redraw when key changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => swapUrl(null), []);

  const current = shown && key !== null && shown.key === key ? shown : null;
  const suffix = seeThrough && style !== 'overlay' ? '-clear' : '';
  const fileName =
    style === 'overlay' ? `climbing-overlay-${date}${climbId ? '-climb' : ''}.png` : style === 'goals' ? `climbing-goals-${dateYear}${suffix}.png` : style === 'year' ? `climbing-year-${dateYear}${suffix}.png` : `climbing-story-${date}${suffix}.png`;
  const hint = STYLES.find((x) => x.id === style)?.hint ?? '';

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': current.blob })]);
      setNote('Copied. Paste it in your Instagram story.');
    } catch {
      setNote('Could not copy. Save the image instead.');
    }
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function save(mode: 'share' | 'download') {
    if (!current) return;
    if (mode === 'share') {
      const file = new File([current.blob], fileName, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return; // closed the share picker
      }
    }
    download(current.blob);
    setNote('Saved to your downloads.');
  }

  if (goals.length === 0) {
    return <p className="py-6 text-[14px]" style={{ color: 'var(--text-2)' }}>Add a goal in the Log tab, then share it here.</p>;
  }

  const message = failed
    ? 'Could not load your climbs. Check your connection and pick the date again.'
    : !dateValid ? 'Pick a date.' : note;

  return (
    <div className="space-y-4 pb-2">
      <div className="flex justify-center pt-1">
        <div
          className={`relative overflow-hidden rounded-[14px] ${style === 'overlay' ? 'flex items-end justify-center px-[6%] pb-[24%]' : ''}`}
          style={{
            height: 'min(42dvh, 440px)',
            aspectRatio: '9 / 16',
            // See-through images sit on a stand-in for a climbing photo, so the clear parts show.
            background: seeThrough ? 'linear-gradient(165deg, #6b7c8f 0%, #3b4656 45%, #1a2029 100%)' : 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {shown && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element -- a generated blob URL, not a file next/image can optimise
            <img src={shown.url} alt="Story preview" aria-label="Story preview" className={style === 'overlay' ? 'w-full' : 'h-full w-full object-contain'} style={{ opacity: current ? 1 : 0.4 }} />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-[13px]" style={{ color: 'var(--text-3)' }} role="status">
              {failed ? 'No preview' : 'Drawing…'}
            </div>
          )}
        </div>
      </div>

      <div role="radiogroup" aria-label="Style" className="flex gap-1 rounded-full p-1" style={{ background: 'var(--surface-2)' }}>
        {STYLES.map((x) => {
          const on = x.id === style;
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStyle(x.id)}
              className="min-h-11 min-w-0 flex-1 rounded-full px-2 text-[14px] font-medium"
              style={{ background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-2)' }}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-[13px]" style={{ color: 'var(--text-3)' }}>{hint}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div hidden={style === 'overlay'}>
          <Label htmlFor="story-bg">Background</Label>
          <Select id="story-bg" className="w-full" value={clearBg ? 'none' : 'dark'} onChange={(e) => setClearBg(e.target.value === 'none')}>
            <option value="dark">Dark background</option>
            <option value="none">No background (on a photo or video)</option>
          </Select>
        </div>
        <div hidden={style !== 'overlay' || dayClimbs.length === 0}>
          <Label htmlFor="story-show">Show</Label>
          <Select id="story-show" className="w-full" value={climbId ?? 'session'} onChange={(e) => setShow(e.target.value)}>
            <option value="session">Whole session ({dayClimbs.length} {dayClimbs.length === 1 ? 'climb' : 'climbs'})</option>
            {dayClimbs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.grade} {x.type} · S{x.session} · {x.attempts === 0 ? 'flash' : `${x.attempts} att`}
              </option>
            ))}
          </Select>
        </div>
        <div hidden={style !== 'story' || sentGoals.length > 0}>
          <Label htmlFor="story-goal">Goal</Label>
          <Select id="story-goal" className="w-full" value={goalId} onChange={(e) => { setGoalId(e.target.value); setGoalTouched(true); }}>
            {goals.map((g) => <option key={g.id} value={g.id}>{goalLabel(g)}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="story-date">Date</Label>
          <Input id="story-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setDateTouched(true); }} />
        </div>
      </div>

      <p className="min-h-5 text-[13px]" role="status" aria-live="polite" style={{ color: failed ? 'var(--danger, var(--text-1))' : 'var(--text-2)' }}>{message}</p>

      {moreStyles && moreStyles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-1 text-[13px]" style={{ color: 'var(--text-3)' }}>
          <span>More styles:</span>
          {moreStyles.map((m) => (
            <button key={m.label} type="button" className="min-h-11 px-2 underline" style={{ color: 'var(--text-2)' }} onClick={m.run}>{m.label}</button>
          ))}
        </div>
      ) : null}

      {/* Primary action stays in view while the form scrolls, inside the sheet (z-50, above the tabs). */}
      <div
        className="sticky bottom-0 -mx-4 flex gap-2 border-t px-4 pt-3 sm:-mx-5 sm:px-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <Button className="flex-1" disabled={!current} onClick={() => void save(canShareFiles ? 'share' : 'download')}>
          {canShareFiles ? <Share2 size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
          {canShareFiles ? 'Share story' : 'Download image'}
        </Button>
        {canCopy && seeThrough && (
          <Button variant="outline" disabled={!current} onClick={() => void copy()} aria-label="Copy image">
            <Copy size={18} aria-hidden="true" />
          </Button>
        )}
        {canShareFiles && (
          <Button variant="outline" disabled={!current} onClick={() => void save('download')} aria-label="Download image">
            <Download size={18} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
