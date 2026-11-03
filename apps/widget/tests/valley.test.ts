import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plantTop, valleyLine, valleySvg, viewTop, SCENE_H } from '../src/logic/valley.ts';
import type { DeviceWorld } from '@journaling/core/world';

const world: DeviceWorld = {
  cols: 12,
  mountain: true,
  flags: 2,
  plants: [
    { name: 'Gym', kind: 'tree', col: 5, row: 0, tiles: 3, stage: 4 },
    { name: 'Coffee', kind: 'sun', col: 7, row: 1, tiles: 1.5, stage: 4 },
  ],
  stars: [{ x: 10, y: 10 }, { x: 50, y: 20 }],
  week: { done: 12, total: 25, met: false },
  tallest: { name: 'Gym', tiles: 3 },
  season: 'summer',
  plantings: [{ tile: 25, kind: 'sun' }, { tile: 90, kind: 'tree' }],
  hives: [60],
  animals: [{ tile: 30, kind: 'deer' }],
};

test('valleySvg: one picture at the asked size, one group per plant', () => {
  const svg = valleySvg(world, 320, 110);
  assert.match(svg, /^<svg [^>]*width="320" height="110"/);
  assert.equal((svg.match(/<g id="plant-/g) ?? []).length, 2);
  assert.equal((svg.match(/<g id="flag-/g) ?? []).length, 2);
  assert.match(svg, /id="mountain"/);
});

test('valleySvg: no mountain and no flags without climbing', () => {
  const svg = valleySvg({ ...world, mountain: false, flags: 0 }, 320, 110);
  assert.doesNotMatch(svg, /id="mountain"/);
  assert.doesNotMatch(svg, /id="flag-/);
});

test('valleySvg: flags are capped so the peak stays readable', () => {
  const svg = valleySvg({ ...world, flags: 30 }, 320, 110);
  assert.equal((svg.match(/<g id="flag-/g) ?? []).length, 6);
});

test('plantTop: a taller plant reaches higher, never above the sky', () => {
  const short = plantTop({ ...world.plants[0], tiles: 1 });
  const tall = plantTop({ ...world.plants[0], tiles: 4 });
  assert.ok(tall < short);
  assert.ok(plantTop({ ...world.plants[0], tiles: 40 }) >= 4);
  assert.ok(short < SCENE_H);
});

test('valleySvg: a wide widget gets more sky and field, not a stretched scene', () => {
  const svg = valleySvg(world, 400, 100);
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(vb);
  assert.equal(Number(vb[2]) + Number(vb[4]), SCENE_H);
  assert.ok(Math.abs(Number(vb[3]) / Number(vb[4]) - 4) < 0.01);
});

test('valleyLine: planted beats tallest, and the week goal follows', () => {
  assert.equal(valleyLine(world), 'Gym is 3 tiles tall · 12 of 20 habits to plant');
  assert.equal(valleyLine({ ...world, week: { done: 20, total: 25, met: true } }), 'Planted this week');
  assert.equal(valleyLine({ ...world, tallest: null, week: { done: 0, total: 0, met: false } }), 'Your valley');
  assert.equal(valleyLine({ ...world, tallest: { name: 'Gym', tiles: 1 } }), 'Gym is 1 tile tall · 12 of 20 habits to plant');
});

test('viewTop: empty sky is cut, but never above the tallest plant or the peak', () => {
  const top = viewTop(world);
  assert.ok(top > 0);
  assert.ok(top < plantTop(world.plants[0]));
  assert.ok(top < 66);
  const tall = { ...world, plants: [{ ...world.plants[0], tiles: 40 }] };
  assert.equal(viewTop(tall), 0);
  const flat = { ...world, mountain: false, plants: [] };
  assert.ok(viewTop(flat) > viewTop(world));
});

test('valleySvg: centred on the field, extra plant columns split left and right like the app', () => {
  const wide: DeviceWorld = { ...world, cols: 14, plants: [...world.plants, { name: 'Read', kind: 'tree', col: 13, row: 0, tiles: 2, stage: 4 }] };
  const svg = valleySvg(wide, 400, 100);
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(vb);
  // The view's centre is the field's centre (12 columns of 16).
  assert.ok(Math.abs(Number(vb[1]) + Number(vb[3]) / 2 - 96) < 0.1);
  // Col 13 is drawn as column 12, right of the field: trunk centre at 12 * 16 + 8.
  const first = svg.match(/<g id="plant-2"><use [^>]*translate\(([\d.]+) /);
  assert.ok(first && Number(first[1]) >= 192 && Number(first[1]) < 208);
});

test('valleySvg: pixel sprites, and only the first field rows', () => {
  const svg = valleySvg(world, 320, 110);
  assert.doesNotMatch(svg, /<(ellipse|circle|line |path)/);
  // Small enough for a home-screen widget.
  assert.ok(svg.length < 120_000, `svg is ${svg.length} chars`);
  // Each sprite's pixels are written once and reused.
  assert.equal((svg.match(/<g id="s-grass"/g) ?? []).length, 0);
  assert.ok((svg.match(/<use /g) ?? []).length > 5);
  assert.match(svg, /shape-rendering="crispEdges"/);
  // A planting in row 2 shows; one in row 7 (tile 90) does not. Same for an animal in row 2 and a hive in row 5.
  const sunYoung = valleySvg({ ...world, plantings: [{ tile: 25, kind: 'sun' }], hives: [], animals: [] }, 320, 110);
  const none = valleySvg({ ...world, plantings: [{ tile: 90, kind: 'sun' }], hives: [], animals: [] }, 320, 110);
  assert.ok(sunYoung.length > none.length);
  assert.equal(valleySvg({ ...world, hives: [] }, 320, 110), valleySvg(world, 320, 110));
});

test('valleySvg: a young plant is one sprite tall, whatever its tiles', () => {
  const young = { ...world.plants[0], stage: 2 as const, tiles: 0.5 };
  assert.equal(plantTop(young), plantTop({ ...young, tiles: 3 }));
});

test('valleySvg: an old saved picture without the new fields still draws', () => {
  const old = { ...world } as Partial<typeof world>;
  delete old.plantings; delete old.hives; delete old.animals; delete old.season;
  assert.match(valleySvg(old as typeof world, 320, 110), /<\/svg>$/);
});
