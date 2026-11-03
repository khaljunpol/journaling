'use client';

import { Pause, Play, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BASE_COLS, frameAt, SKY, TILE, weekCaption, type World } from '@journaling/core/world';
import WorldScene, { caption, type Pick } from './WorldScene';
import { useTimeline } from './useTimeline';

/** One week of the year every 750 ms. */
const WEEK_MS = 750;

/** The sun and the moon circle the field's centre together, one turn per 4 weeks: they set behind the field and rise again. */
const ORBIT = { cx: (BASE_COLS * TILE) / 2, cy: SKY + 8, r: 88 };

function SunAndMoon({ moving }: { moving: boolean }) {
  const { cx, cy, r } = ORBIT;
  // Only the part above the horizon shows: below it they have set behind the field.
  return (
    <g aria-hidden="true" clipPath="url(#v-sky-only)">
      <defs><clipPath id="v-sky-only"><rect x={-4000} y={-4000} width={8000} height={4000 + SKY} /></clipPath></defs>
    <g className="world-orbit" style={{ transformOrigin: `${cx}px ${cy}px`, animationPlayState: moving ? 'running' : 'paused' }} shapeRendering="geometricPrecision">
      <circle cx={cx} cy={cy - r} r={9} fill="#FFD98A" opacity={0.25} />
      <circle cx={cx} cy={cy - r} r={6} fill="#FFD98A" />
      <circle cx={cx} cy={cy + r} r={5} fill="#F6EEDF" />
      <circle cx={cx - 1.5} cy={cy + r - 1} r={1.2} fill="#D9CDB8" />
      <circle cx={cx + 2} cy={cy + r + 1.5} r={0.9} fill="#D9CDB8" />
    </g>
    </g>
  );
}

const label = (monday: string) => new Date(`${monday}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Watch your year": today's valley replayed week by week from the first logged day. Nothing moves; things appear and grow. */
export default function Timelapse({ world, onClose }: { world: World; onClose: () => void }) {
  const { timeline, failed } = useTimeline();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<Pick | null>(null);
  const last = timeline ? timeline.weeks.length - 1 : 0;

  // Start playing as soon as the year has loaded.
  useEffect(() => { if (timeline) setPlaying(true); }, [timeline]);

  useEffect(() => {
    if (!playing || !timeline) return;
    const t = setInterval(() => {
      setI((n) => {
        if (n >= last) return n;
        return n + 1;
      });
    }, WEEK_MS);
    return () => clearInterval(t);
  }, [playing, timeline, last]);

  // The end of the year is today's valley: pause there. Close or play again from the start.
  useEffect(() => {
    if (playing && timeline && i >= last) setPlaying(false);
  }, [playing, timeline, i, last]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const frame = useMemo(() => (timeline ? frameAt(world, timeline, i) : null), [world, timeline, i]);
  const line = useMemo(() => (timeline ? weekCaption(world, timeline, i) : ''), [world, timeline, i]);
  const valley = frame?.world.valleys[frame.valley];
  // This week's plantings pop in.
  const fresh = useMemo(() => new Set(valley && timeline ? valley.plantings.filter((p) => p.week === timeline.weeks[i]).map((p) => p.tile) : []), [valley, timeline, i]);
  const text = picked && frame && valley ? caption(frame.world, valley, picked) : line;
  // One element for the whole run, so the scene's still layers are not redrawn each week.
  const celestial = useMemo(() => <SunAndMoon moving={playing} />, [playing]);

  return (
    <>
      {frame && valley ? (
        <div className="absolute inset-0 px-2 pb-36 pt-14 sm:pb-32">
          <WorldScene world={frame.world} valley={valley} latest={frame.valley === world.valleys.length - 1} fresh={fresh} picked={picked} onPick={setPicked} celestial={celestial} />
        </div>
      ) : null}

      <button type="button" onClick={onClose} aria-label="Close Watch your year" className="press absolute left-2 top-2 flex min-h-11 items-center gap-1 rounded-[10px] px-2 text-[14px]" style={{ color: '#A4AEC4' }}>
        <X size={18} aria-hidden="true" />Close
      </button>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {failed ? (
          <p className="rounded-full px-3 py-0.5 text-center text-[14px]" style={{ color: '#A4AEC4', background: 'rgba(11,13,20,0.55)' }}>Couldn&apos;t load your year. Try again later.</p>
        ) : (
          <p className="min-h-6 max-w-full rounded-full px-3 py-0.5 text-center text-[14px]" style={{ color: '#F3F5F9', background: 'rgba(11,13,20,0.55)' }} aria-live={playing ? 'off' : 'polite'}>
            {timeline ? text : 'Loading your year…'}
          </p>
        )}
        <div className="flex w-full max-w-[560px] items-center gap-3 rounded-full px-2 py-1" style={{ background: 'rgba(11,13,20,0.55)' }}>
          <button type="button" disabled={!timeline} onClick={() => { if (i >= last) setI(0); setPlaying((p) => !p); setPicked(null); }} aria-label={playing ? 'Pause' : 'Play'} className="press flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40" style={{ background: '#F0A24A', color: '#1E1B2A' }}>
            {playing ? <Pause size={18} aria-hidden="true" fill="currentColor" /> : <Play size={18} aria-hidden="true" fill="currentColor" />}
          </button>
          <input
            type="range"
            min={0}
            max={last}
            value={i}
            disabled={!timeline}
            aria-label="Week"
            aria-valuetext={timeline ? label(timeline.weeks[i]) : undefined}
            onChange={(e) => { setPlaying(false); setPicked(null); setI(Number(e.target.value)); }}
            className="world-scrub h-11 min-w-0 flex-1"
          />
          <span className="font-pixel w-[92px] shrink-0 text-right text-[13px]" style={{ color: '#F0A24A' }}>{timeline ? label(timeline.weeks[i]) : ''}</span>
        </div>
      </div>
    </>
  );
}
