'use client';

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import {
  BASE_COLS, displayCol, FIELD_ROWS, HIVE_TILES, mountainShape, mountainSurface, sceneLeft, SKY, TILE, waterTiles,
  type Animal, type Plant, type PlantKind, type Season, type Valley, type World,
} from '@journaling/core/world';
import { PALETTE, SEASON, SPRITES, type SpriteId } from '@journaling/core/sprites';

const H = SKY + FIELD_ROWS * TILE;
/** The field is always 12 columns wide; more habit plants only widen the horizon. */
const FW = BASE_COLS * TILE;

/** Every sprite once, as a <symbol>; rows of one colour merge into one rect. */
const Symbols = memo(function Symbols({ season }: { season: Season }) {
  const pal = { ...PALETTE, ...SEASON[season] };
  return (
    <>
      {(Object.keys(SPRITES) as SpriteId[]).map((id) => (
        <symbol key={id} id={`v-${id}`} viewBox="0 0 16 16" overflow="visible">
          {SPRITES[id].flatMap((row, y) => {
            const out: ReactElement[] = [];
            let x = 0;
            while (x < 16) {
              const ch = row[x];
              let end = x + 1;
              while (end < 16 && row[end] === ch) end += 1;
              if (ch !== '.' && pal[ch]) out.push(<rect key={`${y}-${x}`} x={x} y={y} width={end - x} height={1} fill={pal[ch]} />);
              x = end;
            }
            return out;
          })}
        </symbol>
      ))}
    </>
  );
});

const STAGE = ['seed', 'sprout', 'sapling', 'young'] as const;
const PREFIX: Record<PlantKind, string> = { tree: 'tree', sun: 'sun', bamboo: 'bam' };
const use = (id: string, x: number, y: number, size = TILE) => <use href={`#v-${id}`} x={x} y={y} width={size} height={size} />;
const tileXY = (t: number) => ({ x: (t % BASE_COLS) * TILE, y: SKY + Math.floor(t / BASE_COLS) * TILE });

/** A habit plant: a growth stage in its tile, or a full plant built from parts, taller with every day done. */
function PlantShape({ p }: { p: Plant }) {
  const x = displayCol(p.col) * TILE;
  const base = SKY + (p.row + 1) * TILE;
  if (p.stage < 4) return use(`${PREFIX[p.kind]}-${STAGE[p.stage as 0 | 1 | 2 | 3]}`, x, base - TILE);
  const h = Math.round(p.tiles * TILE);
  const top = base - h;
  const parts: ReactElement[] = [];
  let i = 0;
  for (let y = base - TILE; y > top; y -= TILE, i++) {
    const seg = p.kind === 'tree' ? 'tree-trunk' : p.kind === 'sun' ? (i % 2 ? 'sun-stem2' : 'sun-stem') : 'bam-seg';
    parts.push(<g key={`s${i}`}>{use(seg, x, y)}</g>);
  }
  const head = p.kind === 'tree' ? 'tree-crown' : p.kind === 'sun' ? 'sun-head' : 'bam-top';
  return <>{parts}{use(head, x, top)}</>;
}

export type Pick =
  | { kind: 'plant'; id: string } | { kind: 'planting'; tile: number } | { kind: 'animal'; id: string }
  | { kind: 'flag'; i: number } | { kind: 'summit'; i: number } | { kind: 'lantern'; id: string } | { kind: 'star'; i: number }
  | { kind: 'hive'; i: number } | { kind: 'firefly'; i: number } | { kind: 'cloud'; i: number };

const same = (a: Pick | null, b: Pick) => !!a && JSON.stringify(a) === JSON.stringify(b);

/** A tappable thing with a ring when focused or picked. `tab: false` keeps it out of the Tab order (hundreds of stars). */
function Hit({ pick, picked, onPick, label, ring, className = '', style, tab = true, children }: {
  pick: Pick; picked: Pick | null; onPick: (p: Pick | null) => void; label: string;
  ring: { x: number; y: number; w: number; h: number }; className?: string; style?: CSSProperties; tab?: boolean; children: ReactNode;
}) {
  const on = same(picked, pick);
  const key = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(on ? null : pick); }
  };
  return (
    <g role="button" tabIndex={tab ? 0 : -1} aria-label={label} aria-pressed={on} onClick={(e) => { e.stopPropagation(); onPick(on ? null : pick); }} onKeyDown={key} className={`world-thing cursor-pointer outline-none ${className}`} style={style}>
      {children}
      <rect className="world-ring" x={ring.x + 0.5} y={ring.y + 0.5} width={ring.w - 1} height={ring.h - 1} fill="none" stroke="#FFF6DD" strokeWidth={1} />
    </g>
  );
}

/** Reduced motion, kept up to date if the setting changes while the page is open. */
function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const NAME: Record<string, string> = { tree: 'Young tree', sun: 'Young sunflower', bamboo: 'Young bamboo', rabbit: 'Rabbit', deer: 'Deer', fox: 'Fox', hedgehog: 'Hedgehog' };

/** One line for whatever was tapped. */
export function caption(world: World, valley: Valley, pick: Pick | null): string {
  if (!pick) return '';
  if (pick.kind === 'plant') { const p = world.plants.find((x) => x.id === pick.id); return p ? `${p.name} · ${p.days} ${p.days === 1 ? 'day' : 'days'}` : ''; }
  if (pick.kind === 'planting') { const p = valley.plantings.find((x) => x.tile === pick.tile); return p ? `${NAME[p.kind]} · goal met, week of ${fmt(p.week)}` : ''; }
  if (pick.kind === 'animal') { const a = world.animals.find((x) => x.id === pick.id); return a ? `${a.pair ? 'Deer pair' : NAME[a.kind]} · from ${a.habit}` : ''; }
  if (pick.kind === 'flag') { const f = world.flags[pick.i]; return f ? `${f.grade} · ${fmt(f.date)}` : ''; }
  if (pick.kind === 'summit') { const s = world.summits[pick.i]; return s ? `Summit · ${s.goal} · ${fmt(s.date)}` : ''; }
  if (pick.kind === 'lantern') return world.lanterns.find((l) => l.id === pick.id)?.title ?? '';
  if (pick.kind === 'hive') return `Hive · ${world.workHours.toLocaleString('en-US')} work hours`;
  if (pick.kind === 'firefly') return `Good nights · ${world.goodNights}`;
  if (pick.kind === 'cloud') return `Rest · ${world.restHours.toLocaleString('en-US')} hours`;
  const s = world.stars[pick.i];
  return s ? `Perfect day · ${fmt(s.date)}` : '';
}

type SceneProps = { world: World; valley: Valley; latest: boolean; fresh: Set<number>; picked: Pick | null; onPick: (p: Pick | null) => void };

/** Everything that does not move. Memoised, so the animals and the bird never redraw it. */
const StillLayers = memo(function StillLayers({ world, valley, fresh, picked, onPick }: SceneProps) {
  const W = world.cols * TILE;
  const pal = { ...PALETTE, ...SEASON[world.season] };
  const mount = mountainShape(FW);
  const peak = mount[3];
  const freshOrder = [...fresh];
  const faces = { boulder: [mount[0], peak], rope: [mount[4], peak] } as const;
  const maxStep = (t: 'boulder' | 'rope') => Math.max(1, ...world.flags.filter((f) => f.type === t).map((f) => f.step));
  const flagAt = (type: 'boulder' | 'rope', step: number) => {
    const [a, b] = faces[type];
    const t = step / (maxStep(type) + 1);
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t };
  };
  const streamPts = waterTiles(BASE_COLS).slice(0, 5).map((t) => { const p = tileXY(t); return [p.x + 8, p.y + 8]; });
  // The waterfall leaves the mountain's right face, from the face itself down to the horizon.
  const fallX = FW * 0.64;
  const fallTop = Math.ceil(mountainSurface(fallX, FW) ?? 78) + 1;
  return (
    <>
      <defs>
        <Symbols season={world.season} />
        <pattern id="v-grass" width={TILE} height={TILE} patternUnits="userSpaceOnUse" x={0} y={SKY}>{use('grass', 0, 0)}</pattern>
        <linearGradient id="v-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={SKY}>
          <stop offset="0" stopColor="#0B0D14" />
          <stop offset="0.55" stopColor="#3B2747" />
          <stop offset="1" stopColor="#F0A24A" />
        </linearGradient>
      </defs>

      {/* Sky and ground run far past the scene, so the page never shows a frame. */}
      <rect x={-4000} y={-4000} width={W + 8000} height={4000 + SKY} fill="url(#v-sky)" />
      <rect x={-4000} y={SKY} width={W + 8000} height={4000} fill={pal.g} />
      {/* The grass texture runs past the field too, so the edges never look empty. */}
      <rect x={-4000} y={SKY} width={W + 8000} height={4000} fill="url(#v-grass)" />

      {/* Sky spots are laid out from 0 to the scene width; the scene starts at sceneLeft, so they move with it. */}
      <g transform={`translate(${sceneLeft(world.cols) * TILE},0)`}>
      <g aria-label={`${world.stars.length} perfect days`}>
        {world.stars.map((s, i) => (
          <Hit key={`st${i}`} tab={false} pick={{ kind: 'star', i }} picked={picked} onPick={onPick} label={`Perfect day, ${s.date}`} ring={{ x: s.x - 2, y: s.y - 2, w: 5, h: 5 }} className="world-twinkle" style={{ animationDelay: `${(i % 7) * 0.6}s` }}>
            <rect x={s.x - 1.5} y={s.y - 1.5} width={4} height={4} fill="transparent" />
            <rect x={s.x} y={s.y} width={1} height={1} fill="#FFF6DD" />
          </Hit>
        ))}
      </g>
      {world.constellations.map((c, i) => (
        <g key={`c${i}`} aria-label={`${c.habit} constellation`}>
          {/* Join each star to its nearest earlier neighbour only when close: a light figure, never a web. */}
          {c.stars.map((p, j) => {
            let best: { x: number; y: number } | null = null;
            let d = 18 * 18;
            for (let k = 0; k < j; k++) { const q = c.stars[k]; const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (dd < d) { d = dd; best = q; } }
            return best ? <line key={j} x1={best.x} y1={best.y} x2={p.x} y2={p.y} stroke="rgba(155,140,255,0.4)" strokeWidth={0.5} /> : null;
          })}
          {c.stars.map((p, j) => <rect key={`p${j}`} x={p.x - 0.5} y={p.y - 0.5} width={1.5} height={1.5} fill="#C9C2FF" />)}
        </g>
      ))}
      {world.lanterns.map((l) => (
        <Hit key={l.id} pick={{ kind: 'lantern', id: l.id }} picked={picked} onPick={onPick} label={l.title} ring={{ x: l.x - 4, y: l.y - 5, w: 8, h: 10 }}>
          {use('sky-lantern', l.x - 8, l.y - 8)}
        </Hit>
      ))}
      </g>

      {world.clouds.map((c, i) => (
        <g key={`cl${i}`} className="world-cloud" style={{ animationDelay: `${-i * 23}s`, ['--cloud-from' as string]: `${-(c.x + 32)}px`, ['--cloud-to' as string]: `${W - c.x + 8}px` }}>
          <Hit tab={false} pick={{ kind: 'cloud', i }} picked={picked} onPick={onPick} label={`Rest, ${world.restHours} hours`} ring={{ x: c.x, y: c.y - 6, w: c.size === 1 ? 24 : 18, h: 12 }}>
            {use(c.size === 1 ? 'cloud-1' : 'cloud-2', c.x, c.y - 8, c.size === 1 ? 24 : 18)}
          </Hit>
        </g>
      ))}

      {world.mountain ? (
        <g>
          <polygon points={mount.map((p) => p.join(',')).join(' ')} fill="#3B2F55" shapeRendering="geometricPrecision" />
          <polygon points={`${peak[0]},${peak[1]} ${mount[4][0]},${mount[4][1]} ${FW * 0.62},${SKY} ${FW * 0.56},${70}`} fill="#4A3C6A" shapeRendering="geometricPrecision" />
          <polygon points={`${peak[0]},${peak[1]} ${peak[0] - 7},${peak[1] + 10} ${peak[0] - 2},${peak[1] + 8} ${peak[0] + 2},${peak[1] + 12} ${peak[0] + 7},${peak[1] + 9}`} fill="#EDE7F6" shapeRendering="geometricPrecision" />
          {world.water.waterfall ? (<><rect x={fallX} y={fallTop} width={3} height={SKY - fallTop} fill="#7CC7F2" /><rect x={fallX + 1} y={fallTop + 3} width={1} height={SKY - fallTop - 5} fill="#CFEFFF" /></>) : null}
          {world.flags.map((f, i) => {
            const p = flagAt(f.type, f.step);
            return (
              <Hit key={`f${i}`} pick={{ kind: 'flag', i }} picked={picked} onPick={onPick} label={`${f.grade}, ${f.date}`} ring={{ x: p.x - 1, y: p.y - 9, w: 7, h: 10 }}>
                {use('flag', p.x, p.y - 16)}
              </Hit>
            );
          })}
          {world.summits.map((s, i) => (
            <Hit key={`su${i}`} pick={{ kind: 'summit', i }} picked={picked} onPick={onPick} label={`Summit, ${s.goal}, ${s.date}`} ring={{ x: peak[0] - 1 + i * 6, y: peak[1] - 9, w: 7, h: 10 }}>
              {use('flag', peak[0] + i * 6, peak[1] - 16)}
            </Hit>
          ))}
        </g>
      ) : null}

      {Array.from({ length: BASE_COLS * FIELD_ROWS }, (_, i) => <g key={`g${i}`}>{use((i * 7919) % 13 % 4 === 0 ? 'grass2' : 'grass', (i % BASE_COLS) * TILE, SKY + Math.floor(i / BASE_COLS) * TILE)}</g>)}

      {world.water.stream ? (
        <polyline points={(world.water.waterfall && world.mountain ? [[fallX + 1.5, SKY], ...streamPts] : streamPts).map((p) => p.join(',')).join(' ')} fill="none" stroke="#5BB0E0" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" shapeRendering="geometricPrecision" />
      ) : null}
      {world.water.pond ? <ellipse cx={(BASE_COLS - 1) * TILE} cy={SKY + 7 * TILE + 8} rx={14} ry={6} fill="#3E8FC4" shapeRendering="geometricPrecision" /> : null}

      {valley.plantings.map((p) => {
        const { x, y } = tileXY(p.tile);
        const n = freshOrder.indexOf(p.tile);
        // Young sunflowers and bamboo are drawn at 3/4 size, on the ground, so the field reads as young growth.
        const size = p.kind === 'tree' ? TILE : 12;
        return (
          <Hit key={`pl${p.tile}`} pick={{ kind: 'planting', tile: p.tile }} picked={picked} onPick={onPick} label={`${NAME[p.kind]}, goal met, week of ${p.week}`} ring={{ x, y, w: TILE, h: TILE }} className={n >= 0 ? 'world-pop' : ''} style={n >= 0 ? { animationDelay: `${n * 150}ms` } : undefined}>
            {use(`${PREFIX[p.kind]}-young`, x + (TILE - size) / 2, y + TILE - size, size)}
          </Hit>
        );
      })}

      <Decorations world={world} valley={valley} />

      {world.hives.map((h, i) => {
        const { x, y } = tileXY(h.tile);
        return (
          <Hit key={`hv${i}`} pick={{ kind: 'hive', i }} picked={picked} onPick={onPick} label={`Hive, ${world.workHours} work hours`} ring={{ x, y, w: TILE, h: TILE }}>
            {use('hive', x, y)}
          </Hit>
        );
      })}

      {[...world.plants].sort((a, b) => a.row - b.row).map((p) => {
        const h = p.stage < 4 ? TILE : Math.round(p.tiles * TILE);
        const base = SKY + (p.row + 1) * TILE;
        return (
          <Hit key={p.id} pick={{ kind: 'plant', id: p.id }} picked={picked} onPick={onPick} label={`${p.name}, ${p.days} days`} ring={{ x: displayCol(p.col) * TILE, y: base - h, w: TILE, h }}>
            <PlantShape p={p} />
          </Hit>
        );
      })}
      <Bees world={world} valley={valley} />
      {world.fireflies.map((f, i) => (
        <Hit key={`ff${i}`} tab={false} pick={{ kind: 'firefly', i }} picked={picked} onPick={onPick} label={`Good nights, ${world.goodNights}`} ring={{ x: f.x - 3, y: f.y - 3, w: 6, h: 6 }} className="world-firefly" style={{ animationDelay: `${(i % 9) * 0.45}s` }}>
          {use('firefly-1', f.x - 8, f.y - 8)}
        </Hit>
      ))}
    </>
  );
});

const DECOR = ['tuft', 'wildflower', 'pebbles', 'tuft'] as const;

/** Small things with no meaning, so no part of the ground looks empty: empty horizon spots, free field tiles, and past the field. */
function Decorations({ world, valley }: { world: World; valley: Valley }) {
  const taken = new Set<string>();
  for (const p of world.plants) taken.add(`${displayCol(p.col)},${p.row}`);
  for (const t of [...waterTiles(BASE_COLS), ...HIVE_TILES, ...valley.plantings.map((p) => p.tile), ...world.animals.map((a) => a.tile)]) taken.add(`${t % BASE_COLS},${Math.floor(t / BASE_COLS)}`);
  const out: ReactElement[] = [];
  for (let col = -10; col < world.cols + 10; col++) {
    for (let row = 0; row < FIELD_ROWS; row++) {
      if (taken.has(`${col},${row}`)) continue;
      const inField = col >= 0 && col < BASE_COLS;
      const h = ((col + 20) * 73856093) ^ (row * 19349663);
      const roll = Math.abs(h) % 7;
      if (inField ? roll > 1 : roll > 2) continue;
      out.push(<g key={`d${col},${row}`} aria-hidden="true">{use(DECOR[Math.abs(h >> 3) % DECOR.length], col * TILE, SKY + row * TILE)}</g>);
    }
  }
  return <g pointerEvents="none">{out}</g>;
}

/** A few bees around the sunflowers, one per hive (max 6), drifting slowly. Still with reduced motion (CSS). */
function Bees({ world, valley }: { world: World; valley: Valley }) {
  const flowers = [
    ...world.plants.filter((p) => p.kind === 'sun').map((p) => ({ x: displayCol(p.col) * TILE + 8, y: SKY + (p.row + 1) * TILE - Math.round((p.stage < 4 ? 1 : p.tiles) * TILE) + 6 })),
    ...valley.plantings.filter((p) => p.kind === 'sun').map((p) => { const { x, y } = tileXY(p.tile); return { x: x + 8, y: y + 6 }; }),
  ];
  if (!flowers.length) return null;
  return (
    <g pointerEvents="none" aria-hidden="true">
      {world.hives.map((_, i) => {
        const f = flowers[(i * 5) % flowers.length];
        return <g key={`bee${i}`} className="world-bee" style={{ animationDelay: `${-i * 1.3}s` }}>{use(i % 2 ? 'bee-2' : 'bee-1', f.x - 8 + (i % 3) * 3, f.y - 8)}</g>;
      })}
    </g>
  );
}

/** Animals take a slow step to a free neighbouring tile now and then: at most 2 moving, never onto a planting or water. */
const Animals = memo(function Animals({ animals, blocked, picked, onPick, still }: { animals: Animal[]; blocked: Set<number>; picked: Pick | null; onPick: (p: Pick | null) => void; still: boolean }) {
  const [pos, setPos] = useState<Record<string, { tile: number; left: boolean; step: boolean }>>({});
  const ref = useRef(pos);
  useEffect(() => { ref.current = pos; }, [pos]);
  // A stable key: a refetch of the same animals keeps them where they are.
  const key = animals.map((a) => `${a.id}:${a.tile}`).join('|');
  useEffect(() => {
    const start = Object.fromEntries(animals.map((a) => [a.id, { tile: a.tile, left: false, step: false }]));
    setPos(start);
    ref.current = start;
    if (still || animals.length === 0) return;
    let turn = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const now = { ...ref.current };
      const occupied = new Set(Object.values(now).map((p) => p.tile));
      let moved = false;
      for (let k = 0; k < Math.min(2, animals.length); k++) {
        const a = animals[(turn + k) % animals.length];
        const p = now[a.id];
        if (!p || Math.random() < 0.5) continue;
        const r = Math.floor(p.tile / BASE_COLS);
        const c = p.tile % BASE_COLS;
        // Diagonal steps too: plantings fill every other tile first, so free tiles often touch only at corners.
        const options = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1], [c - 1, r - 1], [c + 1, r - 1], [c - 1, r + 1], [c + 1, r + 1]]
          .filter(([x, y]) => x >= 0 && x < BASE_COLS && y >= 2 && y < FIELD_ROWS)
          .map(([x, y]) => y * BASE_COLS + x)
          .filter((t) => !blocked.has(t) && !occupied.has(t));
        if (!options.length) continue;
        const to = options[Math.floor(Math.random() * options.length)];
        occupied.delete(p.tile);
        occupied.add(to);
        now[a.id] = { tile: to, left: to % BASE_COLS < c ? true : to % BASE_COLS > c ? false : p.left, step: true };
        moved = true;
      }
      turn += 1;
      if (!moved) return;
      setPos(now);
      clearTimeout(settle);
      settle = setTimeout(() => setPos((cur) => Object.fromEntries(Object.entries(cur).map(([id, v]) => [id, { ...v, step: false }]))), 450);
    }, 2600);
    return () => { clearInterval(timer); clearTimeout(settle); };
    // `key` stands for `animals`; `blocked` changes only with the valley.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, blocked, still]);
  return (
    <>
      {animals.map((a) => {
        const at = pos[a.id] ?? { tile: a.tile, left: false, step: false };
        const { x, y } = tileXY(at.tile);
        const frame = at.step || (a.kind === 'deer' && (at.tile % 3 === 0)) ? 2 : 1;
        // The whole group moves (CSS transform), and the flip happens inside it around the tile's own centre.
        return (
          <g key={a.id} className="world-walk" style={{ transform: `translate(${x}px, ${y}px)` }}>
            <Hit pick={{ kind: 'animal', id: a.id }} picked={picked} onPick={onPick} label={`${NAME[a.kind]} from ${a.habit}`} ring={{ x: 0, y: 0, w: TILE, h: TILE }}>
              <g transform={at.left ? `translate(${TILE} 0) scale(-1 1)` : undefined}>{use(`${a.kind}-${frame}`, 0, 0)}</g>
            </Hit>
          </g>
        );
      })}
    </>
  );
});

/** A bird crosses the sky every 20–40 s, flapping only while it flies. None with reduced motion. */
function Bird({ width, still }: { width: number; still: boolean }) {
  const [flight, setFlight] = useState<{ key: number; y: number } | null>(null);
  const [wing, setWing] = useState(false);
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setFlight({ key: Date.now(), y: 16 + Math.round(Math.random() * 30) });
        t = setTimeout(() => { setFlight(null); next(); }, 8000);
      }, 20000 + Math.random() * 20000);
    };
    next();
    return () => clearTimeout(t);
  }, [still]);
  useEffect(() => {
    if (!flight) return;
    const flap = setInterval(() => setWing((w) => !w), 260);
    return () => clearInterval(flap);
  }, [flight]);
  if (!flight) return null;
  return <g key={flight.key} className="world-bird" style={{ ['--world-w' as string]: `${width + 2 * TILE}px` }}>{use(wing ? 'bird-1' : 'bird-2', -TILE, flight.y)}</g>;
}

/** The valley: sky, mountain, horizon plants, field. Sky and grass run past the edges, so it fills any screen without a frame. */
export default function WorldScene(props: SceneProps) {
  const { world, valley, latest, picked, onPick } = props;
  const W = world.cols * TILE;
  const still = useReducedMotion();
  const blocked = useMemo(() => new Set([...waterTiles(BASE_COLS), ...HIVE_TILES, ...valley.plantings.map((p) => p.tile)]), [valley]);
  return (
    <svg viewBox={`${sceneLeft(world.cols) * TILE} 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" style={{ overflow: 'visible' }} shapeRendering="crispEdges" role="group" aria-label={`Your valley: ${world.plants.length} habit plants, ${valley.plantings.length} plantings, ${world.animals.length} animals`} onClick={() => onPick(null)}>
      <StillLayers {...props} />
      {/* Animals live in the newest valley only: older ones are full of plantings. */}
      {latest ? <Animals animals={world.animals} blocked={blocked} picked={picked} onPick={onPick} still={still} /> : null}
      <Bird width={W} still={still} />
    </svg>
  );
}
