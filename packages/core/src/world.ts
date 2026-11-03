// The Valley: a picture of what was done, growing over the year. Pure and deterministic: the same inputs
// give the same world, slots and plantings never move, and nothing shrinks. Relative imports only.
import { gradeLabel, gradeRank } from './climbStats.ts';
import { normalizeGrade } from './climbing.ts';
import { categoryOf, type HabitCategory } from './habitCategory.ts';
import { findSleepIds, sleepNights, type HabitLog, type HourRow } from './overviewStats.ts';
import { groupOf, type StoredGroup } from './timeBalance.ts';
import { addDaysISO, mondayOf } from './quickWeek.ts';
import type { DayScore, GoodCategory } from './scoring.ts';
import type { ClimbGoal, ClimbLog, Sidequest } from './types.ts';

/** Columns of the base scene; more plants widen it. 16 px per tile. */
export const BASE_COLS = 12;
export const TILE = 16;
export const SKY = 112;
/** Field rows below the horizon. Rows 0–1 hold habit plants; rows 2–7 hold plantings, water and animals. */
export const FIELD_ROWS = 8;
const FIRST_OPEN_ROW = 2;
const GOAL_SHARE = 0.8;
const DAYS_PER_ANIMAL = 30;
const MAX_ANIMALS = 8;
const DAYS_PER_STAR = 7;
const HOURS_PER_ANIMAL = 25;
const HOURS_PER_MIND_STAR = 3;
/** Stars drawn per constellation; the tap shows the full hours. */
const MAX_MIND_STARS = 60;
const HOURS_PER_HIVE = 100;
const MAX_HIVES = 6;
const MAX_FIREFLIES = 24;
const HOURS_PER_CLOUD = 10;
const MAX_CLOUDS = 3;
const GOOD_NIGHT = 7;
/** Tiles kept for hives from the start (field edges, clear of the water), in the order they fill. */
export const HIVE_TILES = [5 * 12 + 0, 4 * 12 + 11, 6 * 12 + 0, 5 * 12 + 11, 7 * 12 + 0, 6 * 12 + 11];

export type PlantKind = 'tree' | 'sun' | 'bamboo';
export type PlantRecord = { slot: number; kind: PlantKind; name: string };
export type Plant = { id: string; name: string; kind: PlantKind; slot: number; col: number; row: 0 | 1; days: number; stage: 0 | 1 | 2 | 3 | 4; tiles: number };
export type Planting = { tile: number; kind: PlantKind; week: string };
export type AnimalKind = 'rabbit' | 'deer' | 'fox' | 'hedgehog';
/** `habit`: the People category (or habit) it came from. A deer comes as a pair. */
export type Animal = { id: string; kind: AnimalKind; habit: string; tile: number; since: string; pair?: boolean };
export type Flag = { type: 'boulder' | 'rope'; grade: string; date: string; step: number };
export type Summit = { goal: string; date: string };
export type Lantern = { id: string; title: string; x: number; y: number };
export type Star = { x: number; y: number; date: string };
export type Constellation = { habit: string; stars: Array<{ x: number; y: number }>; hours?: number };
export type Valley = { plantings: Planting[] };
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type World = {
  cols: number;
  plants: Plant[];
  valleys: Valley[];
  animals: Animal[];
  stars: Star[];
  constellations: Constellation[];
  flags: Flag[];
  summits: Summit[];
  lanterns: Lantern[];
  mountain: boolean;
  water: { pond: boolean; stream: boolean; waterfall: boolean };
  level: number;
  season: Season;
  weekGoal: { done: number; total: number; met: boolean };
  /** From hours: hives (Work), fireflies (Sleep 7h+ nights), clouds (Rest). Totals are for tap text. */
  hives: Array<{ tile: number }>;
  workHours: number;
  fireflies: Array<{ x: number; y: number }>;
  goodNights: number;
  /** `x`: a resting spot inside the field, used as is when motion is off. */
  clouds: Array<{ x: number; y: number; size: 1 | 2 }>;
  restHours: number;
};

type Act = { id: string; name: string; category?: HabitCategory };

const KIND: Partial<Record<HabitCategory, PlantKind>> = { move: 'tree', wellbeing: 'sun', other: 'bamboo' };
const ANIMALS: AnimalKind[] = ['deer', 'rabbit', 'fox', 'hedgehog'];
const ROW0 = [5, 7, 3, 9, 1, 11];
const ROW1 = [6, 4, 8, 2, 10, 0];

/** Stage and height in tiles from all-time days done. Full at 30 days, then +1 tile per 60 days; above 5 tiles it slows towards 7. Never goes down. */
export function plantHeight(days: number): { stage: 0 | 1 | 2 | 3 | 4; tiles: number } {
  if (days <= 0) return { stage: 0, tiles: 1 };
  if (days < 7) return { stage: 1, tiles: 1 };
  if (days < 15) return { stage: 2, tiles: 1 };
  if (days < 30) return { stage: 3, tiles: 1 };
  if (days <= 270) return { stage: 4, tiles: 1 + (days - 30) / 60 };
  return { stage: 4, tiles: 5 + 2 * (1 - Math.exp(-(days - 270) / 400)) };
}

/** Where a habit slot stands: two staggered rows at the back, centre out; slots 12+ widen the scene to the right. */
export function slotPosition(slot: number): { col: number; row: 0 | 1 } {
  if (slot < 6) return { col: ROW0[slot], row: 0 };
  if (slot < 12) return { col: ROW1[slot - 6], row: 1 };
  const extra = slot - 12;
  const pair = Math.floor(extra / 2);
  return extra % 2 === 0 ? { col: BASE_COLS + 1 + pair * 2, row: 0 } : { col: BASE_COLS + pair * 2, row: 1 };
}

const colsFor = (slots: number) => (slots <= 12 ? BASE_COLS : BASE_COLS + 2 * Math.ceil((slots - 12) / 2));

/** Stored records stay; a habit that is not stored yet takes the next free slot, ordered by its first log. A re-tag changes the kind in place. */
export function assignSlots(
  firstLog: Map<string, string>,
  records: Record<string, PlantRecord>,
  kinds: Map<string, { kind: PlantKind; name: string }>,
): Record<string, PlantRecord> {
  const out: Record<string, PlantRecord> = {};
  for (const [id, r] of Object.entries(records)) {
    const k = kinds.get(id);
    out[id] = k ? { slot: r.slot, kind: k.kind, name: k.name } : { ...r };
  }
  const used = new Set(Object.values(out).map((r) => r.slot));
  const fresh = [...kinds.keys()].filter((id) => !out[id] && firstLog.has(id))
    .sort((a, b) => (firstLog.get(a) as string).localeCompare(firstLog.get(b) as string) || a.localeCompare(b));
  let next = 0;
  for (const id of fresh) {
    while (used.has(next)) next += 1;
    out[id] = { slot: next, ...(kinds.get(id) as { kind: PlantKind; name: string }) };
    used.add(next);
  }
  return out;
}

/** Field tiles (index = row × cols + col) from the centre out, rows 2–7 only. Every other tile first, so early plantings stand apart. */
export function fieldOrder(cols: number): number[] {
  const cx = (cols - 1) / 2;
  const cy = (FIRST_OPEN_ROW + FIELD_ROWS - 1) / 2;
  const tiles: number[] = [];
  for (let r = FIRST_OPEN_ROW; r < FIELD_ROWS; r++) for (let c = 0; c < cols; c++) tiles.push(r * cols + c);
  tiles.sort((a, b) => {
    const [ax, ay, bx, by] = [a % cols - cx, Math.floor(a / cols) - cy, b % cols - cx, Math.floor(b / cols) - cy];
    return ax * ax + ay * ay - (bx * bx + by * by) || Math.atan2(ay, ax) - Math.atan2(by, bx) || a - b;
  });
  const parity = (t: number) => (Math.floor(t / cols) + (t % cols)) % 2;
  const p0 = parity(tiles[0]);
  return [...tiles.filter((t) => parity(t) === p0), ...tiles.filter((t) => parity(t) !== p0)];
}

/** Tiles kept for water, from the start, so a planting never sits where the stream or pond later appears. */
export function waterTiles(cols: number): number[] {
  const c = cols;
  const at = (col: number, row: number) => row * c + col;
  return [at(c - 4, 2), at(c - 4, 3), at(c - 3, 4), at(c - 3, 5), at(c - 2, 6), at(c - 2, 7), at(c - 1, 7)];
}

/** The mountain behind the horizon, as a polygon in scene px. */
export function mountainShape(width: number): Array<[number, number]> {
  return [[width * 0.1, SKY], [width * 0.36, 78], [width * 0.46, 86], [width * 0.54, 66], [width * 0.78, SKY]];
}

export function inMountain(x: number, y: number, width: number): boolean {
  const p = mountainShape(width);
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A fixed spot in the sky for a key, outside the mountain when there is one. */
function skySpot(key: string, width: number, mountain: boolean, top = 4, bottom = SKY - 6): { x: number; y: number } | null {
  for (let salt = 0; salt < 12; salt++) {
    const h = hash(`${key}#${salt}`);
    const x = 2 + ((h % 1000) / 1000) * (width - 4);
    const y = top + ((Math.imul(h, 2654435761) >>> 0) / 4294967295) * (bottom - top);
    const p = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    if (!mountain || !inMountain(p.x, p.y, width)) return p;
  }
  return null;
}

function seasonOf(today: string): Season {
  const m = Number(today.slice(5, 7));
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

type Week = { monday: string; done: number; total: number; byCat: Record<GoodCategory, number>; days: number };

/** Weeks Monday–Sunday from the day scores. The current week's total counts the days still to come at its average so far. */
function weeksOf(days: DayScore[], today: string): Week[] {
  const by = new Map<string, Week>();
  for (const d of days) {
    if (d.date > today) continue;
    const m = mondayOf(d.date);
    const w = by.get(m) ?? { monday: m, done: 0, total: 0, byCat: { move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 }, days: 0 };
    w.done += d.done;
    w.total += d.total;
    w.days += 1;
    for (const k of Object.keys(w.byCat) as GoodCategory[]) w.byCat[k] += d.byCat[k] ?? 0;
    by.set(m, w);
  }
  const current = mondayOf(today);
  const cw = by.get(current);
  if (cw && cw.days > 0) {
    const left = 6 - Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${current}T12:00:00Z`)) / 86400000);
    cw.total += Math.max(0, left) * (cw.total / cw.days);
  }
  return [...by.values()].sort((a, b) => a.monday.localeCompare(b.monday));
}

const met = (w: Week) => w.total > 0 && w.done >= GOAL_SHARE * w.total;

const MIX: Array<[GoodCategory, PlantKind]> = [['move', 'tree'], ['wellbeing', 'sun'], ['other', 'bamboo']];

/**
 * Kinds for the goal weeks, in order. The mix follows the share of Body, Well-being and Other points so far
 * (largest remainder), so one area that wins every week does not fill the whole field. Mind and People do not plant.
 */
function plantingKinds(weeks: Week[], goal: Week[]): PlantKind[] {
  const earned: Record<string, number> = { move: 0, wellbeing: 0, other: 0 };
  const grown: Record<string, number> = { move: 0, wellbeing: 0, other: 0 };
  const isGoal = new Set(goal.map((w) => w.monday));
  const out: PlantKind[] = [];
  let n = 0;
  for (const w of weeks) {
    for (const [c] of MIX) earned[c] += Math.max(0, w.byCat[c] ?? 0);
    if (!isGoal.has(w.monday)) continue;
    const sum = MIX.reduce((a, [c]) => a + earned[c], 0);
    if (!sum) { out.push('bamboo'); continue; }
    n += 1;
    const owed = (c: string) => (earned[c] / sum) * n - grown[c];
    const pick = MIX.reduce((a, b) => (owed(b[0]) > owed(a[0]) ? b : a));
    grown[pick[0]] += 1;
    out.push(pick[1]);
  }
  return out;
}

export function buildWorld(input: {
  today: string;
  logs: HabitLog[];
  activities: Act[];
  records: Record<string, PlantRecord>;
  days: DayScore[];
  climbs: ClimbLog[];
  goals: ClimbGoal[];
  sidequests: Sidequest[];
  level: number;
  /** All hour slots and the time categories (for their groups). Optional: no hours, nothing from hours. */
  hours?: HourRow[];
  cats?: Array<{ id: string; name: string; group?: StoredGroup }>;
}): World {
  const { today, logs, activities, days, climbs, goals, sidequests, level } = input;
  const hours = input.hours ?? [];
  const cats = input.cats ?? [];

  // Hours per category (one slot = one hour, the first entry per date and hour wins), with each hour's date in order.
  const slot = new Set<string>();
  const hourDates = new Map<string, string[]>();
  for (const h of [...hours].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour)) {
    const d = h.date.slice(0, 10);
    if (d > today || slot.has(`${d}|${h.hour}`)) continue;
    slot.add(`${d}|${h.hour}`);
    const list = hourDates.get(String(h.category)) ?? [];
    list.push(d);
    hourDates.set(String(h.category), list);
  }
  const groupCats = (g: string) => cats.filter((c) => groupOf(c) === g && hourDates.has(String(c.id)))
    .sort((a, b) => (hourDates.get(String(a.id)) as string[])[0].localeCompare((hourDates.get(String(b.id)) as string[])[0]) || String(a.id).localeCompare(String(b.id)));
  const groupHours = (g: string) => groupCats(g).reduce((n, c) => n + (hourDates.get(String(c.id)) as string[]).length, 0);

  // Days ticked per habit, and first log per habit.
  const ticked = new Map<string, Set<string>>();
  const firstLog = new Map<string, string>();
  for (const l of logs) {
    const d = l.date.slice(0, 10);
    if (d > today) continue;
    if (!firstLog.has(l.activityId) || d < (firstLog.get(l.activityId) as string)) firstLog.set(l.activityId, d);
    if (!l.completed) continue;
    const s = ticked.get(l.activityId) ?? new Set<string>();
    s.add(d);
    ticked.set(l.activityId, s);
  }
  const daysOf = (id: string) => ticked.get(id)?.size ?? 0;

  // Plants: good habits (Body, Well-being, Other) plus stored records of habits no longer here.
  const kinds = new Map<string, { kind: PlantKind; name: string }>();
  for (const a of activities) {
    const k = KIND[categoryOf(a)];
    if (k) kinds.set(a.id, { kind: k, name: a.name });
  }
  const records = assignSlots(firstLog, input.records, kinds);
  const slotCount = Math.max(0, ...Object.values(records).map((r) => r.slot + 1));
  const cols = colsFor(slotCount);
  const plants: Plant[] = Object.entries(records)
    .map(([id, r]) => {
      const n = daysOf(id);
      const pos = slotPosition(r.slot);
      return { id, name: r.name, kind: r.kind, slot: r.slot, col: pos.col, row: pos.row, days: n, ...plantHeight(n) };
    })
    .sort((a, b) => a.slot - b.slot);

  // Weekly goal plantings, valley by valley. The field is always 12 columns wide: more habit plants widen only the horizon,
  // so a new habit never moves a planting, the water or an animal.
  const water = new Set(waterTiles(BASE_COLS));
  const reserved = new Set([...water, ...HIVE_TILES]);
  const order = fieldOrder(BASE_COLS).filter((t) => !reserved.has(t));
  const valleys: Valley[] = [{ plantings: [] }];
  const weeks = weeksOf(days, today);
  const goalWeeks = weeks.filter(met);
  const kindsInOrder = plantingKinds(weeks, goalWeeks);
  for (const [i, w] of goalWeeks.entries()) {
    let v = valleys[valleys.length - 1];
    if (v.plantings.length >= order.length) {
      v = { plantings: [] };
      valleys.push(v);
    }
    v.plantings.push({ tile: order[v.plantings.length], kind: kindsInOrder[i], week: w.monday });
  }
  const cw = weeks.find((w) => w.monday === mondayOf(today));
  const weekGoal = cw ? { done: cw.done, total: Math.round(cw.total * 10) / 10, met: met(cw) } : { done: 0, total: 0, met: false };

  // Animals from People habits: one per 30 days done, on free tiles of the newest valley, from the edges in.
  // Animals: from People hours (one per 25 hours per category, its own kind), the first 8 earned. With no People hours,
  // People habit days bring them instead (one per 30 days). They stand on free tiles of the newest valley, edges first.
  const taken = new Set([...reserved, ...valleys[valleys.length - 1].plantings.map((p) => p.tile)]);
  const free = [...fieldOrder(BASE_COLS)].reverse().filter((t) => !taken.has(t));
  type Earned = { id: string; kind: AnimalKind; habit: string; since: string; order: number };
  const earned: Earned[] = [];
  const peopleCats = groupCats('people');
  if (peopleCats.length) {
    peopleCats.forEach((c, i) => {
      const dates = hourDates.get(String(c.id)) as string[];
      for (let n = 1; n * HOURS_PER_ANIMAL <= dates.length; n++) earned.push({ id: `h${c.id}-${n}`, kind: ANIMALS[i % ANIMALS.length], habit: c.name, since: dates[n * HOURS_PER_ANIMAL - 1], order: i });
    });
  } else {
    const people = activities.filter((a) => categoryOf(a) === 'people' && firstLog.has(a.id))
      .sort((a, b) => (firstLog.get(a.id) as string).localeCompare(firstLog.get(b.id) as string) || a.id.localeCompare(b.id));
    people.forEach((a, i) => {
      const dates = [...(ticked.get(a.id) ?? [])].sort();
      for (let n = 1; n * DAYS_PER_ANIMAL <= dates.length; n++) earned.push({ id: `${a.id}-${n}`, kind: ANIMALS[i % ANIMALS.length], habit: a.name, since: dates[n * DAYS_PER_ANIMAL - 1], order: i });
    });
  }
  earned.sort((a, b) => a.since.localeCompare(b.since) || a.order - b.order || a.id.localeCompare(b.id));
  const animals: Animal[] = [];
  for (const e of earned.slice(0, MAX_ANIMALS)) {
    const tile = free[animals.length];
    if (tile === undefined) break;
    animals.push({ id: e.id, kind: e.kind, habit: e.habit, tile, since: e.since, ...(e.kind === 'deer' ? { pair: true } : {}) });
  }

  // Mountain: flags per climb type when the hardest grade goes up; summits per goal reached.
  const width = cols * TILE;
  const mountain = climbs.length > 0;
  const flags: Flag[] = [];
  for (const type of ['boulder', 'rope'] as const) {
    let best: number | null = null;
    let step = 0;
    const mine = climbs.filter((x) => x.type === type && x.date.slice(0, 10) <= today).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const c of mine) {
      const r = gradeRank(type, c.grade);
      if (r === null) continue;
      if (best === null) {
        best = r;
        continue;
      }
      if (r > best) {
        best = r;
        step += 1;
        flags.push({ type, grade: gradeLabel(type, c.grade), date: c.date.slice(0, 10), step });
      }
    }
  }
  flags.sort((a, b) => a.date.localeCompare(b.date));
  const summits: Summit[] = [];
  for (const g of [...goals].sort((a, b) => a.id.localeCompare(b.id))) {
    const hits = climbs
      .filter((c) => c.type === g.type && c.date.startsWith(`${g.year}-`) && c.date.slice(0, 10) <= today && normalizeGrade(c.type, c.grade) === normalizeGrade(g.type, g.grade))
      .map((c) => c.date.slice(0, 10))
      .sort();
    if (g.target > 0 && hits.length >= g.target) summits.push({ goal: `${gradeLabel(g.type, g.grade)} × ${g.target}`, date: hits[g.target - 1] });
  }
  summits.sort((a, b) => a.date.localeCompare(b.date));

  // Sky: a star per perfect day, a lantern per completed sidequest, a constellation per Mind habit.
  const stars: Star[] = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!d.perfect || d.date > today) continue;
    const p = skySpot(d.date, width, mountain);
    if (p) stars.push({ ...p, date: d.date });
  }
  const lanterns: Lantern[] = [];
  const done = sidequests.filter((s) => s.completedAt).sort((a, b) => (a.completedAt as string).localeCompare(b.completedAt as string));
  for (const q of done) {
    const p = skySpot(`lantern:${q.id}`, width, mountain, 10, 70);
    if (p) lanterns.push({ id: q.id, title: q.title, ...p });
  }
  const constellations: Constellation[] = activities
    .filter((a) => categoryOf(a) === 'mind')
    .map((a) => {
      const n = Math.floor(daysOf(a.id) / DAYS_PER_STAR);
      const centre = skySpot(`mind:${a.id}`, width, mountain, 14, 60) ?? { x: width / 2, y: 30 };
      const pts = Array.from({ length: n }, (_, i) => {
        const h = hash(`${a.id}:${i}`);
        return { x: Math.round((centre.x + ((h % 41) - 20)) * 10) / 10, y: Math.round((centre.y + (((h >>> 8) % 25) - 12)) * 10) / 10 };
      });
      return { habit: a.name, stars: pts };
    });
  for (const c of groupCats('mind')) {
    const h = (hourDates.get(String(c.id)) as string[]).length;
    const n = Math.min(MAX_MIND_STARS, Math.floor(h / HOURS_PER_MIND_STAR));
    const centre = skySpot(`mindcat:${c.id}`, width, mountain, 14, 60) ?? { x: width / 2, y: 30 };
    const pts = Array.from({ length: n }, (_, i) => {
      const hh = hash(`cat${c.id}:${i}`);
      // Bigger constellations spread wider, so many stars never pile into a knot.
      const rx = 20 + 3 * Math.sqrt(n);
      const ry = 12 + 1.5 * Math.sqrt(n);
      return { x: Math.round((centre.x + ((hh % 1000) / 1000 - 0.5) * 2 * rx) * 10) / 10, y: Math.max(4, Math.round((centre.y + (((hh >>> 10) % 1000) / 1000 - 0.5) * 2 * ry) * 10) / 10) };
    });
    constellations.push({ habit: c.name, stars: pts, hours: h });
  }

  // Work → hives, Sleep → fireflies, Rest → clouds. Fixed sets: more hours never swap one for another.
  const workHours = groupHours('work');
  const hives = HIVE_TILES.slice(0, Math.min(MAX_HIVES, Math.floor(workHours / HOURS_PER_HIVE))).map((tile) => ({ tile }));
  let goodNights = 0;
  const sleepIds = new Set([...findSleepIds(cats.map((c) => ({ ...c, color: '' }))), ...cats.filter((c) => groupOf(c) === 'sleep').map((c) => String(c.id))]);
  const allDates = [...slot].map((k) => k.slice(0, 10)).sort();
  if (sleepIds.size && allDates.length) {
    const dates: string[] = [];
    for (let d = allDates[0]; d <= today; d = addDaysISO(d, 1)) dates.push(d);
    goodNights = sleepNights(hours, sleepIds, dates, today).filter((n) => (n.hours ?? 0) >= GOOD_NIGHT).length;
  }
  const fireflies = Array.from({ length: Math.min(MAX_FIREFLIES, goodNights) }, (_, i) => {
    const h = hash(`firefly:${i}`);
    return { x: Math.round((4 + ((h % 1000) / 1000) * (BASE_COLS * TILE - 8)) * 10) / 10, y: Math.round((SKY - 6 + (((h >>> 10) % 1000) / 1000) * 70) * 10) / 10 };
  });
  const restHours = groupHours('rest');
  const clouds = Array.from({ length: Math.min(MAX_CLOUDS, Math.floor(restHours / HOURS_PER_CLOUD)) }, (_, i) => {
    const h = hash(`cloud:${i}`);
    return { x: (h >>> 7) % (BASE_COLS * TILE - 24), y: 34 + (h % 36), size: (i % 2 ? 2 : 1) as 1 | 2 };
  });

  return {
    cols,
    plants,
    valleys,
    animals,
    stars,
    constellations,
    flags,
    summits,
    lanterns,
    mountain,
    water: { pond: level >= 5, stream: level >= 10, waterfall: level >= 20 },
    level,
    season: seasonOf(today),
    weekGoal,
    hives,
    workHours,
    fireflies,
    goodNights,
    clouds,
    restHours,
  };
}

/** One line for Overview: this week's goal, and the tallest habit plant. */
export function worldSummary(w: World): { planted: number; tallest: { name: string; tiles: number } | null; weekMet: boolean } {
  const tallest = w.plants.reduce<Plant | null>((a, p) => (!a || p.tiles > a.tiles || (p.tiles === a.tiles && p.days > a.days) ? p : a), null);
  return {
    planted: w.valleys.reduce((n, v) => n + v.plantings.length, 0),
    tallest: tallest ? { name: tallest.name, tiles: tallest.tiles } : null,
    weekMet: w.weekGoal.met,
  };
}
