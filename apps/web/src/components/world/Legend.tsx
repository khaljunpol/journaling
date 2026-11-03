'use client';

import { HelpCircle, X } from 'lucide-react';
import type { World, Valley } from '@journaling/core/world';

type Row = { sprite?: string; swatch?: string; title: string; text: string };

/** What is in this valley and what grows it. Only things that are present are listed. */
function rows(world: World, valley: Valley): Row[] {
  const out: Row[] = [];
  const kinds = new Set(world.plants.map((p) => p.kind));
  if (kinds.has('tree')) out.push({ sprite: 'tree-crown', title: 'Tree', text: 'A Body habit. Grows taller with every day you do it.' });
  if (kinds.has('sun')) out.push({ sprite: 'sun-head', title: 'Sunflower', text: 'A Well-being habit. Grows taller with every day you do it.' });
  if (kinds.has('bamboo')) out.push({ sprite: 'bam-top', title: 'Bamboo', text: 'An Other habit. Grows taller with every day you do it.' });
  if (valley.plantings.length) out.push({ sprite: 'sun-young', title: 'Young plant', text: 'A week you did 80% of your usual habits.' });
  const animals = new Map(world.animals.map((a) => [a.kind, a.habit]));
  for (const [kind, habit] of animals) out.push({ sprite: `${kind}-1`, title: kind === 'deer' ? 'Deer pair' : kind[0].toUpperCase() + kind.slice(1), text: `Your ${habit} hours. One for every 25.` });
  if (world.hives.length) out.push({ sprite: 'hive', title: 'Hive and bees', text: 'Work. One hive for every 100 hours.' });
  if (world.fireflies.length) out.push({ sprite: 'firefly-1', title: 'Firefly', text: 'A night with 7h+ sleep.' });
  if (world.clouds.length) out.push({ sprite: 'cloud-1', title: 'Cloud', text: 'Rest. One for every 10 hours.' });
  if (world.stars.length) out.push({ swatch: '#FFF6DD', title: 'Star', text: 'A perfect day: every usual habit done.' });
  if (world.constellations.some((c) => c.stars.length)) out.push({ swatch: '#C9C2FF', title: 'Constellation', text: 'Mind time: a star for every 3 hours.' });
  if (world.lanterns.length) out.push({ sprite: 'sky-lantern', title: 'Lantern', text: 'A sidequest you finished.' });
  if (world.flags.length) out.push({ sprite: 'flag', title: 'Flag', text: 'A new hardest climbing grade.' });
  if (world.summits.length) out.push({ sprite: 'flag', title: 'Summit flag', text: 'A climbing goal reached.' });
  if (world.water.pond || world.water.stream || world.water.waterfall) out.push({ swatch: '#5BB0E0', title: 'Water', text: 'Levels: a pond at 5, a stream at 10, a waterfall at 20.' });
  return out;
}

/** A "?" button that opens a small list of what is in the valley. Tap again, or the close button, to hide it. */
export default function Legend({ world, valley, open, onToggle }: { world: World; valley: Valley; open: boolean; onToggle: () => void }) {
  const list = rows(world, valley);
  return (
    <>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="world-legend" aria-label={open ? 'Hide what things mean' : 'What do things mean?'} className="press absolute right-2 top-2 flex size-11 items-center justify-center rounded-[10px]" style={{ color: '#A4AEC4' }}>
        {open ? <X size={20} aria-hidden="true" /> : <HelpCircle size={20} aria-hidden="true" />}
      </button>
      {open ? (
        <div id="world-legend" role="dialog" aria-label="What things mean" className="absolute right-2 top-14 max-h-[70dvh] w-[min(320px,calc(100vw-16px))] overflow-y-auto rounded-[14px] p-3" style={{ background: 'rgba(20,24,38,0.94)', color: '#F3F5F9', boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'rgba(79,154,78,0.35)' }} aria-hidden="true">
                  {r.sprite ? (
                    <svg viewBox="0 0 16 16" className="size-7" shapeRendering="crispEdges"><use href={`#v-${r.sprite}`} x={0} y={0} width={16} height={16} /></svg>
                  ) : (
                    <span className="block size-2 rounded-full" style={{ background: r.swatch }} />
                  )}
                </span>
                <span className="min-w-0 text-[13px] leading-snug">
                  <span className="font-medium">{r.title}</span>
                  <span className="block" style={{ color: '#A4AEC4' }}>{r.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
