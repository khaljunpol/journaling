import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, flowerColor, frameAt, MEADOW_SLOTS, meadowSpot, weekCaption, worldTimeline } from '../src/world.ts';
import { weeklyMoods } from '../src/overviewStats.ts';
import { addDaysISO } from '../src/quickWeek.ts';

const today = '2026-02-04'; // Wednesday; this week starts 2026-02-02
const base = { today, logs: [], activities: [], records: {}, days: [], climbs: [], goals: [], sidequests: [], level: 1 };
/** n days of one mood from a date. */
const run = (from: string, n: number, score: number) => Array.from({ length: n }, (_, i) => ({ date: addDaysISO(from, i), score }));

test('weeklyMoods: one mean per day first, then the mean of those days', () => {
  const moods = [{ date: '2026-01-05', score: 4 }, { date: '2026-01-05', score: 8 }, { date: '2026-01-06', score: 9 }];
  assert.equal(weeklyMoods(moods, today).get('2026-01-05'), 7.5);
});

test('weather follows this week so far: clear at 7, clouds from 5, rain under 5, clear with no mood', () => {
  const at = (score: number) => buildWorld({ ...base, moods: run('2026-02-02', 3, score) }).mood.weather;
  assert.deepEqual([at(7), at(6.9), at(5), at(4.9)], ['clear', 'cloudy', 'cloudy', 'rain']);
  assert.deepEqual(buildWorld(base).mood, { avg: null, weather: 'clear', rainbow: false });
  assert.deepEqual(buildWorld(base).flowers, []);
});

test('a rainbow after a hard week: last week under 5 and this week at least 1.5 better', () => {
  const w = (last: number, now: number) => buildWorld({ ...base, moods: [...run('2026-01-26', 7, last), ...run('2026-02-02', 3, now)] }).mood.rainbow;
  assert.equal(w(4, 5.5), true);
  assert.equal(w(4, 5.4), false);
  assert.equal(w(5, 7), false);
});

test('a wildflower per finished good week, brighter for a better week; this week never counts yet', () => {
  const moods = [...run('2026-01-05', 7, 8), ...run('2026-01-12', 7, 6), ...run('2026-01-19', 7, 7.4), ...run('2026-02-02', 3, 9)];
  const f = buildWorld({ ...base, moods }).flowers;
  assert.deepEqual(f.map((x) => x.week), ['2026-01-05', '2026-01-19']);
  assert.equal(f[0].color, flowerColor(8));
  assert.equal(f[1].color, flowerColor(7));
  assert.deepEqual([7, 8, 9, 10].map(flowerColor), ['#FFD98A', '#F0A24A', '#FB7185', '#9B8CFF']);
  assert.equal(f[1].avg, 7.4);
});

test('meadow spots: 72 distinct spots beside the field, never in its 12 columns or the plant rows', () => {
  const spots = Array.from({ length: MEADOW_SLOTS }, (_, k) => meadowSpot(k));
  assert.equal(new Set(spots.map((s) => `${s.x},${s.y}`)).size, MEADOW_SLOTS);
  for (const s of spots) {
    assert.ok(s.x < 0 || s.x >= 192, `x ${s.x}`);
    assert.ok(s.y >= 112 + 32 && s.y < 112 + 128, `y ${s.y}`);
  }
});

test('past 72 good weeks the newest stay, each at its own fixed spot', () => {
  const start = '2024-01-01';
  const moods = Array.from({ length: 80 }, (_, k) => ({ date: addDaysISO(start, k * 7), score: 8 }));
  const f = buildWorld({ ...base, today: '2026-02-04', moods }).flowers;
  assert.equal(f.length, MEADOW_SLOTS);
  assert.equal(f[0].week, addDaysISO(start, 8 * 7));
  assert.deepEqual({ x: f[0].x, y: f[0].y }, meadowSpot(8 % MEADOW_SLOTS));
});

test('the last frame keeps today\'s mood and flowers; earlier frames use their own week', () => {
  const moods = [...run('2026-01-05', 7, 8), ...run('2026-01-12', 7, 4), ...run('2026-01-19', 7, 6), ...run('2026-02-02', 3, 7)];
  const input = { ...base, moods, logs: [{ date: '2026-01-05', activityId: 'x', completed: true }] };
  const w = buildWorld(input);
  const t = worldTimeline(input);
  const last = frameAt(w, t, t.weeks.length - 1).world;
  assert.deepEqual(last.mood, w.mood);
  assert.deepEqual(last.flowers, w.flowers);
  assert.equal(frameAt(w, t, 1).world.mood.weather, 'rain');
  assert.equal(frameAt(w, t, 0).world.flowers.length, 1);
  assert.equal(frameAt(w, t, 2).world.mood.rainbow, true);
  assert.match(weekCaption(w, t, 2), /a rainbow after a hard week/);
});

test('an old saved world without mood or flowers still replays', () => {
  const input = { ...base, moods: run('2026-01-05', 7, 8), logs: [{ date: '2026-01-05', activityId: 'x', completed: true }] };
  const t = worldTimeline(input);
  const old = { ...buildWorld(input) } as Partial<ReturnType<typeof buildWorld>>;
  delete old.mood; delete old.flowers;
  const w = old as ReturnType<typeof buildWorld>;
  for (let i = 0; i < t.weeks.length; i++) {
    const f = frameAt(w, t, i).world;
    assert.deepEqual(f.flowers, []);
    assert.ok(f.mood);
    assert.equal(typeof weekCaption(w, t, i), 'string');
  }
});
