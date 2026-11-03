import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignSlots, buildWorld, deviceWorld, displayCol, fieldOrder, mountainShape, mountainSurface, sceneLeft, SKY, inMountain, plantHeight, slotPosition, waterTiles, worldSummary,
  type PlantRecord,
} from '../src/world.ts';
import { addDaysISO } from '../src/quickWeek.ts';
import type { DayScore } from '../src/scoring.ts';

const today = '2026-11-03'; // Tuesday
const back = (i: number) => addDaysISO(today, -i);
const cats0 = { move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 };
const tick = (date: string, activityId: string) => ({ date, activityId, completed: true });
const score = (date: string, done: number, total: number, by: Partial<typeof cats0> = {}, perfect = false): DayScore =>
  ({ date, points: done * 10, done, total, perfect, byCat: { ...cats0, ...by } });
const base = { today, logs: [], activities: [], records: {}, days: [], climbs: [], goals: [], sidequests: [], level: 1 };

test('plantHeight: stages, full at 30 days, +1 tile per 60 days, then slows towards 7 tiles', () => {
  const h = (d: number) => plantHeight(d);
  assert.deepEqual([0, 1, 6, 7, 14, 15, 29].map((d) => h(d).stage), [0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([h(30), h(90), h(270)].map((x) => [x.stage, x.tiles]), [[4, 1], [4, 2], [4, 5]]);
  const a = h(400).tiles, b = h(1000).tiles, c = h(9000).tiles;
  assert.ok(a > 5 && b > a && c > b && c < 7);
});

test('slotPosition: row 0 odd columns then row 1 even columns, centre out; extra slots widen right', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((s) => slotPosition(s).col), [5, 7, 3, 9, 1, 11]);
  assert.deepEqual([6, 7, 8, 9, 10, 11].map((s) => slotPosition(s).col), [6, 4, 8, 2, 10, 0]);
  assert.deepEqual([0, 6].map((s) => slotPosition(s).row), [0, 1]);
  assert.deepEqual([12, 13, 14, 15].map((s) => [slotPosition(s).col, slotPosition(s).row]), [[13, 0], [12, 1], [15, 0], [14, 1]]);
});

test('assignSlots: keeps old records, new habits take the next slot by first log, re-tag changes kind in place', () => {
  const records: Record<string, PlantRecord> = { a: { slot: 0, kind: 'tree', name: 'Gym' }, gone: { slot: 1, kind: 'sun', name: 'Old' } };
  const first = new Map([['a', '2026-01-01'], ['b', '2026-03-01'], ['c', '2026-02-01'], ['gone', '2025-12-01']]);
  const kinds = new Map([['a', { kind: 'bamboo' as const, name: 'Gym' }], ['b', { kind: 'sun' as const, name: 'Vitamins' }], ['c', { kind: 'tree' as const, name: 'Run' }]]);
  const out = assignSlots(first, records, kinds);
  assert.deepEqual(out.a, { slot: 0, kind: 'bamboo', name: 'Gym' });
  assert.deepEqual(out.gone, { slot: 1, kind: 'sun', name: 'Old' });
  assert.equal(out.c.slot, 2);
  assert.equal(out.b.slot, 3);
});

test('plants: one per good habit with rows, height from distinct days ticked; bad, People and Mind get none', () => {
  const activities = [
    { id: 'g', name: 'Gym' }, { id: 'v', name: 'Vitamins' }, { id: 'c', name: 'Coffee' },
    { id: 'x', name: 'Beer' }, { id: 'p', name: 'Date night' }, { id: 'm', name: 'Read' },
  ];
  const logs = [
    ...Array.from({ length: 200 }, (_, i) => tick(back(i), 'v')), tick(back(0), 'v'),
    tick(back(1), 'g'), tick(back(2), 'c'), tick(back(1), 'x'), tick(back(1), 'p'), tick(back(1), 'm'),
  ];
  const w = buildWorld({ ...base, activities, logs });
  assert.deepEqual(w.plants.map((p) => [p.name, p.kind]).sort(), [['Coffee', 'bamboo'], ['Gym', 'tree'], ['Vitamins', 'sun']]);
  const vit = w.plants.find((p) => p.name === 'Vitamins')!;
  assert.equal(vit.days, 200);
  assert.ok(Math.abs(vit.tiles - (1 + 170 / 60)) < 1e-9);
  assert.equal(w.constellations.length, 1);
});

test('a deleted habit keeps its plant from its stored record and logs', () => {
  const w = buildWorld({ ...base, logs: [tick(back(3), 'old'), tick(back(2), 'old')], records: { old: { slot: 4, kind: 'tree', name: 'Climb' } } });
  assert.deepEqual(w.plants.map((p) => [p.name, p.slot, p.days]), [['Climb', 4, 2]]);
});

test('weekly goal: every 2nd week at 80% plants one, 79% does not count; kind from the best of body, well-being, other', () => {
  // Weeks of Mon 2026-10-19 and 2026-10-26: 8 of 10 done → met (mind is highest but falls back to well-being).
  // Week of Mon 2026-10-12: 11 of 14 done → 78.6% → not met.
  const met = (dd: number) => [0, 1, 2, 3, 4].map((k, i) => score(addDaysISO(`2026-10-${dd}`, k), i < 3 ? 2 : 1, 2, { wellbeing: 20, mind: 90 }));
  const notMet = Array.from({ length: 7 }, (_, i) => score(`2026-10-${12 + i}`, i < 4 ? 2 : i < 6 ? 1 : 1, 2));
  const one = buildWorld({ ...base, days: [...met(19), ...notMet] });
  assert.deepEqual(one.valleys[0].plantings, []);
  const two = buildWorld({ ...base, days: [...met(19), ...met(26), ...notMet] });
  assert.deepEqual(two.valleys[0].plantings.map((p) => [p.week, p.kind]), [['2026-10-26', 'sun']]);
});

test('weekly goal: the current week plants before Sunday once 80% is reached', () => {
  // Saturday: 6 days of 2/2 done; the week total is estimated as 12 + one more day of 2 = 14, and 12/14 ≥ 80%.
  const days = [2, 3, 4, 5, 6, 7].map((d) => score(`2026-11-0${d}`, 2, 2, { move: 20 }));
  const before = Array.from({ length: 7 }, (_, i) => score(addDaysISO('2026-10-26', i), 2, 2, { move: 20 }));
  const first = buildWorld({ ...base, today: '2026-11-07', days });
  assert.deepEqual([first.weekGoal.met, first.weekGoal.plants], [true, false]);
  const w = buildWorld({ ...base, today: '2026-11-07', days: [...before, ...days] });
  assert.deepEqual([w.weekGoal.met, w.weekGoal.plants], [true, true]);
  assert.deepEqual(w.valleys[0].plantings.map((p) => [p.week, p.kind]), [['2026-11-02', 'tree']]);
});

test('plantings fill the field centre out and never sit on water tiles', () => {
  const days = Array.from({ length: 200 }, (_, i) => score(addDaysISO('2023-01-02', i * 7), 1, 1, { other: 10 }));
  const w = buildWorld({ ...base, today: '2026-11-03', days, level: 20 });
  const water = new Set(waterTiles(12));
  const all = w.valleys.flatMap((v) => v.plantings);
  assert.equal(all.length, 100);
  assert.ok(all.every((p) => !water.has(p.tile)));
  assert.equal(w.valleys[0].plantings[0].tile, fieldOrder(12)[0]);
  assert.ok(w.valleys.length >= 2);
});

test('animals: one per 30 days of a People habit, max 8, never on a planting or water', () => {
  const activities = [{ id: 'p', name: 'Date night', category: 'people' as const }];
  const logs = Array.from({ length: 310 }, (_, i) => tick(back(i), 'p'));
  const days = [score('2026-10-19', 1, 1, { other: 10 })];
  const w = buildWorld({ ...base, activities, logs, days, level: 10 });
  assert.equal(w.animals.length, 8);
  const taken = new Set([...waterTiles(12), ...w.valleys[w.valleys.length - 1].plantings.map((p) => p.tile)]);
  assert.ok(w.animals.every((a) => !taken.has(a.tile)));
  assert.equal(new Set(w.animals.map((a) => a.tile)).size, 8);
});

test('mountain flags: per type when the hardest grade goes up; the first send and bad grades give none', () => {
  const climbs = [
    { id: '1', date: '2026-01-01', session: 0, type: 'boulder' as const, grade: 'V3', attempts: 1 },
    { id: '2', date: '2026-02-01', session: 0, type: 'boulder' as const, grade: 'V5', attempts: 1 },
    { id: '3', date: '2026-03-01', session: 0, type: 'boulder' as const, grade: 'V4', attempts: 1 },
    { id: '4', date: '2026-04-01', session: 0, type: 'rope' as const, grade: '6a', attempts: 1 },
    { id: '5', date: '2026-05-01', session: 0, type: 'rope' as const, grade: '6b', attempts: 1 },
    { id: '6', date: '2026-06-01', session: 0, type: 'boulder' as const, grade: '???', attempts: 1 },
  ];
  const w = buildWorld({ ...base, climbs });
  assert.deepEqual(w.flags.map((f) => [f.type, f.date, f.step]), [['boulder', '2026-02-01', 1], ['rope', '2026-05-01', 1]]);
});

test('summit: one per climbing goal, dated when the target is reached', () => {
  const climbs = [1, 2, 3].map((i) => ({ id: `${i}`, date: `2026-0${i}-10`, session: 0, type: 'boulder' as const, grade: 'V4', attempts: 1 }));
  const goals = [{ id: 'g1', year: 2026, type: 'boulder' as const, grade: 'V4', target: 2 }, { id: 'g2', year: 2026, type: 'boulder' as const, grade: 'V8', target: 1 }];
  assert.deepEqual(buildWorld({ ...base, climbs, goals }).summits.map((s) => s.date), ['2026-02-10']);
});

test('lanterns for completed sidequests; stars for perfect days, never inside the mountain', () => {
  const sidequests = [{ id: 's1', title: 'Run 10k', type: 'count' as const, year: 2026, createdAt: '2026-01-01', completedAt: '2026-05-01' }, { id: 's2', title: 'Open', type: 'count' as const, year: 2026, createdAt: '2026-01-01' }];
  const days = Array.from({ length: 300 }, (_, i) => score(addDaysISO('2026-01-01', i), 1, 1, {}, true));
  const w = buildWorld({ ...base, sidequests, days, climbs: [{ id: '1', date: '2026-01-01', session: 0, type: 'boulder', grade: '5', attempts: 1 }] });
  assert.deepEqual(w.lanterns.map((l) => l.title), ['Run 10k']);
  assert.ok(w.stars.length > 250);
  assert.ok(w.stars.every((s) => !inMountain(s.x, s.y, 192)));
});

test('same input, same world; summary', () => {
  const activities = [{ id: 'g', name: 'Gym' }];
  const logs = Array.from({ length: 100 }, (_, i) => tick(back(i), 'g'));
  const a = buildWorld({ ...base, activities, logs });
  assert.deepEqual(a, buildWorld({ ...base, activities, logs }));
  assert.deepEqual(worldSummary(a).tallest, { name: 'Gym', tiles: 1 + 70 / 60 });
});

test('plantings mix by the share of points so far, not only the top area each week', () => {
  // Every week: well-being 60, body 30, other 10 → over 20 plantings about 12 sunflowers, 6 trees, 2 bamboo.
  const days = Array.from({ length: 40 }, (_, i) => score(addDaysISO('2025-06-02', i * 7), 1, 1, { wellbeing: 60, move: 30, other: 10 }));
  const kinds = buildWorld({ ...base, days }).valleys[0].plantings.map((p) => p.kind);
  const n = (k: string) => kinds.filter((x) => x === k).length;
  assert.deepEqual([n('sun'), n('tree'), n('bamboo')], [12, 6, 2]);
});

test('plantings take every other tile first, so the field never looks like a grid early on', () => {
  const order = fieldOrder(12);
  const firstHalf = order.slice(0, 30).map((t) => (Math.floor(t / 12) + (t % 12)) % 2);
  assert.ok(firstHalf.every((p) => p === firstHalf[0]));
});

test('a 13th habit widens the horizon but never moves a planting or the water', () => {
  const days = Array.from({ length: 10 }, (_, i) => score(addDaysISO('2026-01-05', i * 7), 1, 1, { other: 10 }));
  const twelve = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, name: `Gym ${i}` }));
  const logs = (acts: Array<{ id: string }>) => acts.map((a) => tick(back(1), a.id));
  const a = buildWorld({ ...base, days, activities: twelve, logs: logs(twelve) });
  const thirteen = [...twelve, { id: 'h12', name: 'Gym 12' }];
  const b = buildWorld({ ...base, days, activities: thirteen, logs: logs(thirteen) });
  assert.ok(b.cols > a.cols);
  assert.deepEqual(b.valleys, a.valleys);
});

// ── Hours in the valley ─────────────────────────────────────────────────────
const hoursOf = (cat: string, n: number, from = '2026-06-01') =>
  Array.from({ length: n }, (_, i) => ({ date: addDaysISO(from, Math.floor(i / 8)), hour: 8 + (i % 8), category: cat }));
const cats = [
  { id: 'w', name: 'work' }, { id: 'f', name: 'freelance' }, { id: 'pt', name: 'partner' }, { id: 'fr', name: 'friends' },
  { id: 'm', name: 'language class' }, { id: 'r', name: 'leisure time' }, { id: 's', name: 'sleep' }, { id: 'c', name: 'chores' },
];

test('hives: one per 100 work hours, at most 6, on their own tiles; plantings never use them', () => {
  const days = Array.from({ length: 70 }, (_, i) => score(addDaysISO('2025-01-06', i * 7), 1, 1, { other: 10 }));
  const w = buildWorld({ ...base, days, cats, hours: [...hoursOf('w', 500), ...hoursOf('f', 150, '2026-09-01')] });
  assert.equal(w.hives.length, 6);
  assert.equal(w.workHours, 650);
  const hive = new Set(w.hives.map((h) => h.tile));
  assert.ok(w.valleys.flatMap((v) => v.plantings).every((p) => !hive.has(p.tile)));
  assert.equal(buildWorld({ ...base, cats, hours: hoursOf('w', 250) }).hives.length, 2);
});

test('animals from People hours: one per 25 hours per category, its own kind, first 8 earned stay', () => {
  const hours = [...hoursOf('pt', 60, '2026-01-01'), ...hoursOf('fr', 30, '2026-04-01')];
  const w = buildWorld({ ...base, cats, hours });
  assert.deepEqual(w.animals.map((a) => [a.kind, a.habit]), [['deer', 'partner'], ['deer', 'partner'], ['rabbit', 'friends']]);
  const more = buildWorld({ ...base, cats, hours: [...hoursOf('pt', 400, '2026-01-01'), ...hoursOf('fr', 30, '2026-04-01')] });
  assert.equal(more.animals.length, 8);
  assert.deepEqual(more.animals.slice(0, 2).map((a) => a.since), w.animals.slice(0, 2).map((a) => a.since));
});

test('animals fall back to People habit days when no People hours exist', () => {
  const activities = [{ id: 'p', name: 'Date night', category: 'people' as const }];
  const logs = Array.from({ length: 60 }, (_, i) => tick(back(i), 'p'));
  assert.equal(buildWorld({ ...base, activities, logs, cats, hours: hoursOf('w', 10) }).animals.length, 2);
  assert.equal(buildWorld({ ...base, activities, logs, cats, hours: hoursOf('pt', 30) }).animals.length, 1);
});

test('Mind hours: one star per 3 hours, one constellation per category', () => {
  const w = buildWorld({ ...base, cats, hours: hoursOf('m', 31) });
  assert.deepEqual(w.constellations.map((c) => [c.habit, c.stars.length]), [['language class', 10]]);
});

test('fireflies per good night (max 24) and clouds per 10 rest hours (max 3)', () => {
  const nights = Array.from({ length: 30 }, (_, i) => Array.from({ length: 8 }, (_, h) => ({ date: addDaysISO('2026-03-01', i), hour: h, category: 's' }))).flat();
  const w = buildWorld({ ...base, cats, hours: [...nights, ...hoursOf('r', 25)] });
  assert.equal(w.goodNights, 30);
  assert.equal(w.fireflies.length, 24);
  assert.equal(w.restHours, 25);
  assert.equal(w.clouds.length, 2);
});

test('no hours: nothing from hours, the rest unchanged', () => {
  const w = buildWorld({ ...base });
  assert.deepEqual([w.hives.length, w.fireflies.length, w.clouds.length, w.workHours, w.goodNights, w.restHours], [0, 0, 0, 0, 0, 0]);
});

test('clouds have a fixed spot inside the field width, so they show without motion', () => {
  const w = buildWorld({ ...base, cats, hours: hoursOf('r', 40) });
  assert.ok(w.clouds.every((c) => c.x >= 0 && c.x < 192 - 24));
});

test('a constellation draws at most 60 stars, however many Mind hours', () => {
  const w = buildWorld({ ...base, cats, hours: hoursOf('m', 900) });
  assert.equal(w.constellations[0].stars.length, 60);
  assert.equal(w.constellations[0].hours, 900);
});

test('summary says whether there are climbing logs', () => {
  assert.equal(worldSummary(buildWorld(base)).climbed, false);
  const climbs = [{ id: '1', date: '2026-01-01', session: 0, type: 'boulder' as const, grade: '5', attempts: 1 }];
  assert.equal(worldSummary(buildWorld({ ...base, climbs })).climbed, true);
});

test('deviceWorld: a small picture for the widget', () => {
  const activities = [{ id: 'g', name: 'Gym' }, { id: 'c', name: 'Coffee' }];
  const logs = [...Array.from({ length: 100 }, (_, i) => tick(back(i), 'g')), ...Array.from({ length: 20 }, (_, i) => tick(back(i), 'c'))];
  const climbs = [{ id: '1', date: '2026-01-01', session: 0, type: 'boulder' as const, grade: '5', attempts: 1 }];
  const w = buildWorld({ ...base, activities, logs, climbs });
  const d = deviceWorld(w);
  assert.equal(d.cols, w.cols);
  assert.equal(d.mountain, true);
  assert.equal(d.flags, w.flags.length);
  assert.deepEqual(d.plants.map((p) => p.name).sort(), ['Coffee', 'Gym']);
  for (const p of d.plants) assert.deepEqual(Object.keys(p).sort(), ['col', 'kind', 'name', 'row', 'stage', 'tiles']);
  assert.equal(d.season, w.season);
  const v = w.valleys[w.valleys.length - 1];
  assert.deepEqual(d.plantings, v.plantings.map((p) => ({ tile: p.tile, kind: p.kind })));
  assert.deepEqual(d.animals, w.animals.map((a) => ({ tile: a.tile, kind: a.kind })));
  assert.deepEqual(d.hives, w.hives.map((h) => h.tile));
  assert.ok(d.stars.length <= 40);
  assert.deepEqual(d.week, w.weekGoal);
  assert.deepEqual(d.tallest, worldSummary(w).tallest);
});

test('deviceWorld: stars are capped and keep their place', () => {
  const days = Array.from({ length: 400 }, (_, i) => score(addDaysISO('2025-10-01', i), 1, 1, {}, true));
  const w = buildWorld({ ...base, days });
  const d = deviceWorld(w);
  assert.equal(d.stars.length, Math.min(40, w.stars.length));
  assert.deepEqual(d.stars[0], { x: w.stars[0].x, y: w.stars[0].y });
});

test('displayCol: the field keeps cols 0-11; extra plant columns alternate left and right', () => {
  for (let c = 0; c < 12; c++) assert.equal(displayCol(c), c);
  // Slot 12 sits at col 13 (front row), slot 13 at col 12 (back row): one pair, one column on each side.
  assert.equal(displayCol(12), -1);
  assert.equal(displayCol(13), 12);
  assert.equal(displayCol(14), -2);
  assert.equal(displayCol(15), 13);
});

test('sceneLeft: the scene is centred on the field', () => {
  assert.equal(sceneLeft(12), 0);
  assert.equal(sceneLeft(14), -1);
  assert.equal(sceneLeft(16), -2);
  for (const cols of [12, 14, 16, 18]) {
    const left = sceneLeft(cols);
    const used = Array.from({ length: cols }, (_, c) => displayCol(c));
    assert.equal(Math.min(...used), left);
    assert.equal(Math.max(...used), left + cols - 1);
    // Same number of columns on each side of the field.
    assert.equal(0 - left, left + cols - 12);
  }
});

test('constellations stay inside the scene, so the sky never leans to one side', () => {
  for (const n of [31, 300, 900]) {
    for (let id = 0; id < 40; id++) {
      const mind = [{ id: `m${id}`, name: 'Reading', group: 'mind' as const }];
      const w = buildWorld({ ...base, cats: mind, hours: hoursOf(`m${id}`, n) });
      const width = w.cols * 16;
      for (const c of w.constellations) for (const s of c.stars) assert.ok(s.x >= 2 && s.x <= width - 2, `x ${s.x} in 0..${width}`);
    }
  }
});

test('mountainSurface: the top edge of the mountain at x, so a waterfall starts on it', () => {
  const w = 192;
  const [, , , peak, foot] = mountainShape(w);
  assert.equal(mountainSurface(peak[0], w), peak[1]);
  assert.equal(mountainSurface(foot[0], w), SKY);
  const mid = (peak[0] + foot[0]) / 2;
  assert.ok(Math.abs(mountainSurface(mid, w) - (peak[1] + SKY) / 2) < 0.01);
  assert.ok(inMountain(mid, mountainSurface(mid, w) + 1, w));
  assert.ok(!inMountain(mid, mountainSurface(mid, w) - 1, w));
  assert.equal(mountainSurface(w * 0.95, w), null);
});
