import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysToLock, onlyNewRows, openDays, parseScoreRows, scoreRowValues, totals } from '../src/ledger.ts';
import type { DayScore } from '../src/scoring.ts';

const cats = { move: 0, wellbeing: 0, mind: 0, people: 0, other: 0 };
const s = (date: string, points: number, perfect = false): DayScore => ({ date, points, done: 1, total: 2, perfect, byCat: { ...cats, move: points } });

test('daysToLock: first run starts at the first logged day and stops 8 days before today', () => {
  const d = daysToLock(null, '2026-10-20', '2026-11-03');
  assert.equal(d[0], '2026-10-20');
  assert.equal(d[d.length - 1], '2026-10-26');
});

test('daysToLock: continues after the cursor, nothing when up to date or no data', () => {
  assert.deepEqual(daysToLock('2026-10-24', '2026-10-01', '2026-11-03'), ['2026-10-25', '2026-10-26']);
  assert.deepEqual(daysToLock('2026-10-26', '2026-10-01', '2026-11-03'), []);
  assert.deepEqual(daysToLock(null, null, '2026-11-03'), []);
});

test('openDays: today and the 7 days before', () => {
  const o = openDays('2026-11-03');
  assert.deepEqual([o.length, o[0], o[7]], [8, '2026-10-27', '2026-11-03']);
});

test('scoreRowValues: column order', () => {
  assert.deepEqual(scoreRowValues(s('2026-10-01', 40, true), 'T'), ['2026-10-01', 40, 1, 2, 1, 40, 0, 0, 0, 0, 'T', 1]);
});

test('parseScoreRows: first row per date wins, junk and out-of-range points read as 0', () => {
  const m = parseScoreRows([
    ['2026-10-01', '40', '1', '2', '1', '40', '0', '0', '0', '0', 'T', '1'],
    ['2026-10-01', '125', '2', '2', '1', '100', '0', '0', '0', '0', 'T', '1'],
    ['2026-10-02', '999', '1', '2', '0'],
    ['2026-10-03', 'abc'],
    ['not a date', '10'],
    [],
  ]);
  assert.deepEqual([...m.keys()], ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(m.get('2026-10-01')?.points, 40);
  assert.equal(m.get('2026-10-01')?.perfect, true);
  assert.equal(m.get('2026-10-02')?.points, 0);
  assert.equal(m.get('2026-10-03')?.points, 0);
});

test('totals: locked plus open, a date in both counts once (locked wins)', () => {
  const locked = parseScoreRows([scoreRowValues(s('2026-10-01', 40, true), 'T'), scoreRowValues(s('2026-10-02', 20), 'T')]);
  assert.deepEqual(totals(locked, [s('2026-10-02', 99), s('2026-11-03', 35, true)]), { points: 95, perfectDays: 2 });
});

test('onlyNewRows skips dates already in the sheet and repeats in the batch', () => {
  const existing = [scoreRowValues(s('2026-10-01', 40), 'T')];
  const out = onlyNewRows(existing, [s('2026-10-01', 99), s('2026-10-02', 20), s('2026-10-02', 30)]);
  assert.deepEqual(out.map((x) => [x.date, x.points]), [['2026-10-02', 20]]);
});
