import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plantTop, valleyLine, valleySvg, viewTop, SCENE_H } from '../src/logic/valley.ts';
import type { DeviceWorld } from '@journaling/core/world';

const world: DeviceWorld = {
  cols: 12,
  mountain: true,
  flags: 2,
  plants: [
    { name: 'Gym', kind: 'tree', col: 5, row: 0, tiles: 3 },
    { name: 'Coffee', kind: 'sun', col: 7, row: 1, tiles: 1.5 },
  ],
  stars: [{ x: 10, y: 10 }, { x: 50, y: 20 }],
  week: { done: 12, total: 25, met: false },
  tallest: { name: 'Gym', tiles: 3 },
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
