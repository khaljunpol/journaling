import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeChunks, keepingFromPayloads, KEEPING_DAYS } from '../src/lib/keepingRange.ts';
import type { DayData } from '@journaling/core/quickDay';

test('rangeChunks: 35 days split into reads of at most 14 days', () => {
  const chunks = rangeChunks('2026-09-30', '2026-11-03', 14);
  assert.deepEqual(chunks, [
    ['2026-09-30', '2026-10-13'],
    ['2026-10-14', '2026-10-27'],
    ['2026-10-28', '2026-11-03'],
  ]);
  for (const [a, b] of chunks) assert.ok(b >= a);
});

test('rangeChunks: a short range is one read', () => {
  assert.deepEqual(rangeChunks('2026-11-01', '2026-11-03', 14), [['2026-11-01', '2026-11-03']]);
});

test('KEEPING_DAYS covers 5 weeks', () => {
  assert.equal(KEEPING_DAYS, 35);
});

const day = (date: string, mood: number | null): DayData => ({ date, mood, logs: [], hours: [], weight: null, highlight: '', climbs: 0, sidequestLogIds: [] });

test('keepingFromPayloads: days from every chunk count', () => {
  const k = keepingFromPayloads('2026-11-03', [
    { days: { '2026-10-13': day('2026-10-13', 7) }, stamps: [] },
    { days: { '2026-11-02': day('2026-11-02', 6) }, stamps: [] },
  ]);
  assert.ok(k);
  const states = new Map(k.weeks.flatMap((w) => w.days.map((d) => [d.date, d.state] as const)));
  // A day from the oldest chunk reads as logged, and tracking starts there.
  assert.equal(states.get('2026-10-13'), 'onTime');
  assert.equal(states.get('2026-10-14'), 'missed');
  assert.equal(states.get('2026-11-02'), 'onTime');
  assert.equal(states.get('2026-10-12'), null);
});

test('keepingFromPayloads: nothing loaded gives null', () => {
  assert.equal(keepingFromPayloads('2026-11-03', []), null);
});
