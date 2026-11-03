import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, frameAt, weekCaption, worldTimeline } from '../src/world.ts';
import { addDaysISO } from '../src/quickWeek.ts';
import { levelFor, type DayScore } from '../src/scoring.ts';

const today = '2026-02-04'; // Wednesday
const cats0 = { move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 };
const tick = (date: string, activityId: string) => ({ date, activityId, completed: true });
const score = (date: string, points: number, perfect = false): DayScore => ({ date, points, done: 1, total: 1, perfect, byCat: { ...cats0 } });
const base = { today, logs: [], activities: [], records: {}, days: [], climbs: [], goals: [], sidequests: [], level: 1 };
const hoursOf = (cat: string, n: number, from: string) =>
  Array.from({ length: n }, (_, i) => ({ date: addDaysISO(from, Math.floor(i / 8)), hour: 8 + (i % 8), category: cat }));
const cats = [
  { id: 'w', name: 'Job', group: 'work' as const },
  { id: 's', name: 'Bed', group: 'sleep' as const },
  { id: 'm', name: 'Study', group: 'mind' as const },
  { id: 'r', name: 'Couch', group: 'rest' as const },
];

test('weeks run Monday to Monday from the first data week to this week', () => {
  const t = worldTimeline({ ...base, logs: [tick('2026-01-07', 'g')] });
  assert.equal(t.weeks[0], '2026-01-05');
  assert.equal(t.weeks[t.weeks.length - 1], '2026-02-02');
  assert.equal(t.weeks.length, 5);
});

test('plant days so far grow week by week and end at the plant days', () => {
  const activities = [{ id: 'g', name: 'Gym', category: 'move' as const }];
  const logs = Array.from({ length: 21 }, (_, i) => tick(addDaysISO('2026-01-05', i), 'g'));
  const input = { ...base, activities, logs };
  const t = worldTimeline(input);
  assert.deepEqual(t.plants.g, [7, 14, 21, 21, 21]);
  assert.equal(t.plants.g.at(-1), buildWorld(input).plants.find((p) => p.id === 'g')?.days);
});

test('hives, clouds and constellation stars carry the date they were earned', () => {
  const hours = [...hoursOf('w', 250, '2026-01-05'), ...hoursOf('m', 31, '2026-01-05'), ...hoursOf('r', 25, '2026-01-05')];
  const activities = [{ id: 'b', name: 'Book', category: 'mind' as const }];
  const logs = Array.from({ length: 21 }, (_, i) => tick(addDaysISO('2026-01-05', i), 'b'));
  const input = { ...base, activities, logs, cats, hours };
  const t = worldTimeline(input);
  const w = buildWorld(input);
  assert.equal(t.hives.length, 2);
  assert.equal(t.hives[1], hoursOf('w', 250, '2026-01-05')[199].date);
  assert.equal(t.clouds.length, w.clouds.length);
  assert.equal(t.constellations.length, w.constellations.length);
  w.constellations.forEach((c, i) => assert.equal(t.constellations[i].length, c.stars.length));
  for (const list of t.constellations) assert.deepEqual(list, [...list].sort());
});

test('lanterns use the completed day, with or without a time part', () => {
  const sidequests = [
    { id: 's1', title: 'Run 10k', type: 'count' as const, year: 2026, createdAt: '2026-01-01', completedAt: '2026-01-20T10:00:00Z' },
    { id: 's2', title: 'Open', type: 'count' as const, year: 2026, createdAt: '2026-01-01' },
  ];
  const t = worldTimeline({ ...base, sidequests });
  assert.deepEqual(t.lanterns, { s1: '2026-01-20' });
});

test('level per week sums points up to that week', () => {
  const days = Array.from({ length: 21 }, (_, i) => score(addDaysISO('2026-01-05', i), 100));
  const t = worldTimeline({ ...base, days });
  assert.deepEqual(t.level.slice(0, 3), [7, 14, 21].map((n) => levelFor(100 * n).level));
  assert.equal(t.level.at(-1), levelFor(2100).level);
});

test('group hours per week leave nothing out; the mountain starts with the first climb', () => {
  const hours = [...hoursOf('w', 10, '2026-01-12'), ...hoursOf('s', 5, '2026-01-15')];
  const climbs = [{ id: 'c', date: '2026-01-20', session: 0, type: 'boulder' as const, grade: '5', attempts: 1 }];
  const t = worldTimeline({ ...base, logs: [tick('2026-01-05', 'x')], cats, hours, climbs });
  assert.equal(t.groups[1].work, 10);
  assert.equal(t.groups[1].sleep, 5);
  assert.equal(t.groups[0].work ?? 0, 0);
  assert.equal(t.mountainFrom, '2026-01-20');
});

test('no data: one week, empty lists', () => {
  const t = worldTimeline(base);
  assert.deepEqual(t.weeks, ['2026-02-02']);
  assert.deepEqual([t.hives, t.fireflies, t.clouds, t.constellations], [[], [], [], []]);
  assert.deepEqual(t.lanterns, {});
  assert.equal(t.mountainFrom, null);
});

// ---- frameAt and weekCaption ----
const cellsOf = (cat: string, n: number, from: string, start = 8, perDay = 8) =>
  Array.from({ length: n }, (_, i) => ({ date: addDaysISO(from, Math.floor(i / perDay)), hour: start + (i % perDay), category: cat }));
const met = (date: string, by: Partial<typeof cats0>, perfect = false): DayScore => ({ date, points: 50, done: 2, total: 2, perfect, byCat: { ...cats0, ...by } });
const people = [{ id: 'p', name: 'Friends', group: 'people' as const }];

function rich() {
  const activities = [{ id: 'g', name: 'Gym', category: 'move' as const }, { id: 'c', name: 'Coffee', category: 'wellbeing' as const }];
  const logs = [
    ...Array.from({ length: 30 }, (_, i) => tick(addDaysISO('2026-01-05', i), 'g')),
    ...Array.from({ length: 10 }, (_, i) => tick(addDaysISO('2026-01-19', i), 'c')),
  ];
  const days = Array.from({ length: 30 }, (_, i) => met(addDaysISO('2026-01-05', i), { wellbeing: 30, move: 10 }, i % 9 === 0));
  const hours = [...cellsOf('w', 22, '2026-01-05'), ...cellsOf('p', 25, '2026-01-08'), ...cellsOf('s', 50, '2026-01-05', 0, 7), ...cellsOf('r', 30, '2026-01-20')];
  const climbs = [
    { id: 'a', date: '2026-01-06', session: 0, type: 'boulder' as const, grade: '5', attempts: 1 },
    { id: 'b', date: '2026-01-21', session: 0, type: 'boulder' as const, grade: '6A', attempts: 1 },
  ];
  const sidequests = [{ id: 's1', title: 'Run 10k', type: 'count' as const, year: 2026, createdAt: '2026-01-01', completedAt: '2026-01-27T09:00:00Z' }];
  return { ...base, activities, logs, days, hours, cats: [...cats, ...people], climbs, sidequests, level: levelFor(1500).level };
}

test('the last frame is today\'s world', () => {
  const input = rich();
  const w = buildWorld(input);
  const t = worldTimeline(input);
  const f = frameAt(w, t, t.weeks.length - 1).world;
  for (const k of ['plants', 'valleys', 'animals', 'stars', 'flags', 'lanterns', 'hives', 'fireflies', 'clouds', 'water', 'mountain'] as const) assert.deepEqual(f[k], w[k], k);
  assert.deepEqual(f.constellations.map((c) => c.stars.length), w.constellations.map((c) => c.stars.length));
});

test('things never move between frames, and the first frame is nearly empty', () => {
  const input = rich();
  const w = buildWorld(input);
  const t = worldTimeline(input);
  for (let i = 0; i < t.weeks.length; i++) {
    const f = frameAt(w, t, i).world;
    for (const a of f.animals) assert.equal(a.tile, w.animals.find((x) => x.id === a.id)?.tile);
    for (const s of f.stars) assert.ok(w.stars.some((x) => x.x === s.x && x.y === s.y && x.date === s.date));
    for (const p of f.plants) assert.equal(p.col, w.plants.find((x) => x.id === p.id)?.col);
  }
  const first = frameAt(w, t, 0).world;
  assert.equal(first.plants.find((p) => p.id === 'c'), undefined);
  assert.equal(first.lanterns.length, 0);
  assert.equal(first.flags.length, 0);
  assert.equal(first.mountain, true);
});

test('a plant not logged yet is hidden; it grows week by week', () => {
  const input = rich();
  const w = buildWorld(input);
  const t = worldTimeline(input);
  const gym = (i: number) => frameAt(w, t, i).world.plants.find((p) => p.id === 'g');
  assert.equal(gym(0)?.days, 7);
  assert.ok((gym(3)?.days ?? 0) > (gym(1)?.days ?? 0));
  assert.equal(frameAt(w, t, 1).world.plants.find((p) => p.id === 'c'), undefined);
});

test('two valleys: the frame shows the valley filling at that week', () => {
  const days = Array.from({ length: 100 }, (_, i) => met(addDaysISO('2024-01-01', i * 7), { wellbeing: 10 }));
  const input = { ...base, today: '2026-02-04', days };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  assert.equal(w.valleys.length, 2);
  assert.equal(frameAt(w, t, 10).valley, 0);
  assert.equal(frameAt(w, t, t.weeks.length - 1).valley, 1);
  assert.ok(frameAt(w, t, 10).world.valleys[0].plantings.length <= 11);
});

test('caption: top two groups without sleep, then events', () => {
  const input = rich();
  const w = buildWorld(input);
  const t = worldTimeline(input);
  assert.equal(weekCaption(w, t, 0), 'Jan 5 · 25h people, 22h work · planted a young sunflower, a deer arrived');
});

test('caption: no hours shows only events; a quiet week shows only the date', () => {
  // Perfect days in a week that misses the goal (1 of 2 done), so nothing is planted.
  const days = [{ ...met('2026-01-05', {}, true), done: 1 }, { ...met('2026-01-06', {}, true), done: 1 }];
  const input = { ...base, days, logs: [tick('2026-01-19', 'x')] };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  assert.equal(weekCaption(w, t, 0), 'Jan 5 · 2 perfect days');
  assert.equal(weekCaption(w, t, 1), 'Jan 12');
});

// ---- review fixes ----
test('a seed plant (logged, never done) is in the last frame, from its first log', () => {
  const activities = [{ id: 'g', name: 'Gym', category: 'move' as const }, { id: 'y', name: 'Yoga', category: 'move' as const }];
  const logs = [...Array.from({ length: 21 }, (_, i) => tick(addDaysISO('2026-01-05', i), 'g')), { date: '2026-01-20', activityId: 'y', completed: false }];
  const input = { ...base, activities, logs };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  assert.ok(w.plants.some((p) => p.id === 'y'));
  assert.deepEqual(frameAt(w, t, t.weeks.length - 1).world.plants, w.plants);
  assert.equal(frameAt(w, t, 0).world.plants.find((p) => p.id === 'y'), undefined);
  assert.ok(frameAt(w, t, 2).world.plants.find((p) => p.id === 'y'));
});

test('the last week ends today: its season is today\'s', () => {
  // Monday 2026-11-30: the week runs into December (winter), but today is still autumn.
  const input = { ...base, today: '2026-11-30', logs: [tick('2026-11-02', 'x')] };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  assert.equal(frameAt(w, t, t.weeks.length - 1).world.season, w.season);
});

test('a lantern or climb dated after today (time zones) still shows in the last frame', () => {
  const sidequests = [{ id: 's1', title: 'Run 10k', type: 'count' as const, year: 2026, createdAt: '2026-01-01', completedAt: '2026-02-05T01:00:00Z' }];
  const climbs = [{ id: 'c', date: '2026-02-05', session: 0, type: 'boulder' as const, grade: '5', attempts: 1 }];
  const input = { ...base, logs: [tick('2026-01-05', 'x')], sidequests, climbs };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  const last = frameAt(w, t, t.weeks.length - 1).world;
  assert.deepEqual(last.lanterns, w.lanterns);
  assert.equal(last.mountain, w.mountain);
});
