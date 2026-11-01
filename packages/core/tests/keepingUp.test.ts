import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepingUp } from '../src/keepingUp.ts';
import type { DayStamp, StampKind } from '../src/dayState.ts';

const start = '2026-11-02'; // a Monday
const stamp = (date: string, kind: StampKind, at: string): DayStamp => ({ date, kind, at });
const from = (stamps: DayStamp[]) => (date: string, kind: StampKind) => stamps.some((s) => s.date === date && s.kind === kind);

test('nothing until a tracked day has finished', () => {
  assert.equal(keepingUp({ today: '2026-11-02', stamps: [], hasPart: () => false, start }), null);
  assert.notEqual(keepingUp({ today: '2026-11-03', stamps: [], hasPart: () => false, start }), null);
});

test('four weeks, oldest first, with states', () => {
  const stamps = [
    stamp('2026-11-02', 'mood', '2026-11-02T10:00:00.000Z'),
    stamp('2026-11-03', 'mood', '2026-11-04T10:00:00.000Z'),
  ];
  const k = keepingUp({ today: '2026-11-05', stamps, hasPart: from(stamps), start })!;
  assert.deepEqual(k.weeks.map((w) => w.monday), ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
  assert.deepEqual(k.weeks[3].days.map((d) => d.state), ['onTime', 'late', 'missed', 'waiting', null, null, null]);
  assert.deepEqual(k.weeks[2].days.map((d) => d.state), [null, null, null, null, null, null, null]);
});

test('counts: on time over finished days, late and skipped per part', () => {
  const stamps = [
    stamp('2026-11-02', 'mood', '2026-11-02T10:00:00.000Z'),
    stamp('2026-11-02', 'hours', '2026-11-03T10:00:00.000Z'),
    stamp('2026-11-03', 'mood', '2026-11-03T10:00:00.000Z'),
  ];
  const k = keepingUp({ today: '2026-11-04', stamps, hasPart: from(stamps), start })!;
  assert.equal(k.onTime, 2);
  assert.equal(k.total, 2);
  assert.deepEqual(k.parts, [
    { kind: 'mood', late: 0, skipped: 0 },
    { kind: 'habits', late: 0, skipped: 2 },
    { kind: 'hours', late: 1, skipped: 1 },
    { kind: 'weight', late: 0, skipped: 2 },
  ]);
  assert.deepEqual(k.lines, ['2 of 2 days on time']);
});

test('old late stamps stay out of the dots and the counts', () => {
  const stamps = [
    stamp('2026-10-20', 'mood', '2026-10-27T10:00:00.000Z'),
    stamp('2026-11-02', 'mood', '2026-11-02T10:00:00.000Z'),
  ];
  const k = keepingUp({ today: '2026-11-03', stamps, hasPart: from(stamps), start })!;
  assert.equal(k.weeks[1].days[1].state, null);
  assert.equal(k.parts[0].late, 0);
});

test('lines leave the patterns to Details', () => {
  const stamps: DayStamp[] = [];
  stamps.push(stamp('2026-11-08', 'hours', '2026-11-09T10:00:00.000Z'), stamp('2026-11-15', 'hours', '2026-11-16T10:00:00.000Z'));
  const k = keepingUp({ today: '2026-11-20', stamps, hasPart: () => true, start })!;
  assert.deepEqual(k.patterns, ['You log late most on Sundays', 'You forget hours most']);
  assert.ok(!k.lines.some((l) => l.startsWith('You')));
});
