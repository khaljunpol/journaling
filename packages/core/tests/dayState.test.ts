import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayHasData, dayState, lateLines, stampTime, appDay, type DayStamp } from '../src/dayState.ts';
import { habitStreakGrace, type HabitDay } from '../src/overviewStats.ts';

const START = '2026-11-02'; // a Monday
const stamp = (date: string, at: string, kind: DayStamp['kind'] = 'mood'): DayStamp => ({ date, kind, at });
/** 18:00 UTC on that date. */
const evening = (date: string) => `${date}T18:00:00.000Z`;

test('UTC midnight is the line: 22:30 UTC in November is already the next day', () => {
  assert.equal(appDay(new Date('2026-11-03T21:59:00Z')), '2026-11-03');
  assert.equal(appDay(new Date('2026-11-03T22:01:00Z')), '2026-11-04');
});

test('a day logged the same day is on time', () => {
  assert.equal(dayState('2026-11-03', [stamp('2026-11-03', evening('2026-11-03'))], true, '2026-11-05', START), 'onTime');
});

test('a day logged the next day is late', () => {
  assert.equal(dayState('2026-11-03', [stamp('2026-11-03', evening('2026-11-04'))], true, '2026-11-05', START), 'late');
});

test('the first part logged decides the day', () => {
  const s = [stamp('2026-11-03', evening('2026-11-04'), 'habits'), stamp('2026-11-03', evening('2026-11-03'), 'mood')];
  assert.equal(dayState('2026-11-03', s, true, '2026-11-05', START), 'onTime');
});

test('nothing logged: today is waiting, an earlier day is missed', () => {
  assert.equal(dayState('2026-11-05', [], false, '2026-11-05', START), 'waiting');
  assert.equal(dayState('2026-11-04', [], false, '2026-11-05', START), 'missed');
});

test('data with no stamp is on time, because the stamp failed to save', () => {
  assert.equal(dayState('2026-11-03', [], true, '2026-11-05', START), 'onTime');
});

test('days before tracking and days to come have no state', () => {
  assert.equal(dayState('2026-11-01', [], false, '2026-11-05', START), null);
  assert.equal(dayState('2026-11-06', [], false, '2026-11-05', START), null);
});

test('a highlight alone does not count as data', () => {
  assert.equal(dayHasData({ mood: null, weight: null, logs: [], hours: [null, null] }), false);
  assert.equal(dayHasData({ mood: null, weight: null, logs: [], hours: [null, 3] }), true);
  assert.equal(dayHasData({ mood: 0, weight: null, logs: [], hours: [] }), true);
});

test('stamp time: a believable tap time wins', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  assert.equal(stampTime(now - 3600_000, now), '2026-11-05T11:00:00.000Z');
});

test('stamp time: missing, future or very old times use the server clock', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  const server = '2026-11-05T12:00:00.000Z';
  assert.equal(stampTime(null, now), server);
  assert.equal(stampTime(NaN, now), server);
  assert.equal(stampTime(now + 1000, now), server);
  assert.equal(stampTime(now - 8 * 86400_000, now), server);
});

const texts = (l: Array<{ text: string; tone: string }>) => l.map((x) => `${x.tone}: ${x.text}`);

test('lines: missed days and the on-time count for the week', () => {
  // Thursday 2026-11-05. Mon on time, Tue late, Wed missed.
  const stamps = [stamp('2026-11-02', evening('2026-11-02')), stamp('2026-11-03', evening('2026-11-04'))];
  const hasData = (d: string) => d < '2026-11-04';
  assert.deepEqual(texts(lateLines(stamps, hasData, '2026-11-05', START)), [
    'bad: 1 day to fill in this week',
    'bad: 1 of 3 days on time this week',
    'good: 1 day rescued this month',
  ]);
});

test('lines: a clean week is good news', () => {
  const dates = ['2026-11-02', '2026-11-03', '2026-11-04'];
  const stamps = dates.map((d) => stamp(d, evening(d)));
  assert.deepEqual(texts(lateLines(stamps, () => true, '2026-11-05', START)), ['good: 3 of 3 days on time this week']);
});

test('lines: patterns wait for 14 days of tracking', () => {
  const stamps = [stamp('2026-11-02', evening('2026-11-03')), stamp('2026-11-09', evening('2026-11-10'))];
  const few = texts(lateLines(stamps, () => true, '2026-11-12', START));
  assert.ok(!few.some((t) => t.includes('most')));
  const many = texts(lateLines(stamps, () => true, '2026-11-20', START));
  assert.ok(many.includes('neutral: You log late most on Mondays'));
  assert.ok(many.includes('neutral: You forget mood most'));
});

test('lines: a tie is not a pattern', () => {
  const stamps = [stamp('2026-11-02', evening('2026-11-03')), stamp('2026-11-03', evening('2026-11-04'), 'hours')];
  assert.ok(!texts(lateLines(stamps, () => true, '2026-11-20', START)).some((t) => t.includes('most')));
});

const day = (date: string, share: number): HabitDay => ({ date, done: share ? 1 : 0, active: 2, share });

test('streak: an unfilled day this week waits, and adds nothing', () => {
  const days = [day('2026-11-03', 1), day('2026-11-04', 0), day('2026-11-05', 1), day('2026-11-06', 0)];
  const logged = new Set(['2026-11-03', '2026-11-05']);
  assert.deepEqual(habitStreakGrace(days, logged, '2026-11-06', START), { streak: 2, waiting: 1 });
});

test('streak: a logged day under half still ends it', () => {
  const days = [day('2026-11-03', 1), day('2026-11-04', 0), day('2026-11-05', 1), day('2026-11-06', 0)];
  const logged = new Set(['2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepEqual(habitStreakGrace(days, logged, '2026-11-06', START), { streak: 1, waiting: 0 });
});

test('streak: an empty day older than 7 days ends it', () => {
  const days = [day('2026-11-03', 1), day('2026-11-04', 0), day('2026-11-05', 0), day('2026-11-06', 0), day('2026-11-07', 0), day('2026-11-08', 0), day('2026-11-09', 0), day('2026-11-10', 0), day('2026-11-11', 0), day('2026-11-12', 0), day('2026-11-13', 0)];
  assert.deepEqual(habitStreakGrace(days, new Set(['2026-11-03']), '2026-11-13', START), { streak: 0, waiting: 7 });
});

test('streak: no grace before tracking started', () => {
  const days = [day('2026-10-29', 1), day('2026-10-30', 0), day('2026-10-31', 1), day('2026-11-01', 0)];
  assert.deepEqual(habitStreakGrace(days, new Set(['2026-10-29', '2026-10-31']), '2026-11-01', START), { streak: 1, waiting: 0 });
});

test('an old day filled in later is late; with data and no stamp it is on time; with nothing it has no state', () => {
  const stamps = [{ date: '2026-09-15', kind: 'mood' as const, at: '2026-11-05T10:00:00.000Z' }];
  assert.equal(dayState('2026-09-15', stamps, true, '2026-11-05'), 'late');
  assert.equal(dayState('2026-09-16', stamps, true, '2026-11-05'), 'onTime');
  assert.equal(dayState('2026-09-17', stamps, false, '2026-11-05'), null);
});

test('streak: by default, grace covers recent days before tracking started too', () => {
  const days = [day('2026-10-29', 1), day('2026-10-30', 0), day('2026-10-31', 1), day('2026-11-01', 0)];
  assert.deepEqual(habitStreakGrace(days, new Set(['2026-10-29', '2026-10-31']), '2026-11-01'), { streak: 2, waiting: 1 });
});
