// Made-up sample data for a demo sheet: about half a year of habits, moods, weights, hours,
// climbs and two sidequests, ending on `today`. Same `today` gives the same rows.
// Every row matches HEADERS in sheetLayout.ts and the forms the readers in googleSheets.ts parse.
// Relative imports only, so tests can load it.
import { HEADERS, TABS, type TabKey } from './sheetLayout.ts';

const DAYS = 182;

/** Small seeded PRNG: same seed, same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const p2 = (n: number) => String(n).padStart(2, '0');

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}

/** 0 = Sunday. */
function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function mondayOf(iso: string): string {
  const dow = weekday(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

// Categories map to valley plants: move = tree, wellbeing = sun, other = bamboo.
const HABITS: Array<{ id: string; name: string; category: string; p: number }> = [
  { id: 'demo-walk', name: 'Walk', category: 'move', p: 0.7 },
  { id: 'demo-stretch', name: 'Stretch', category: 'wellbeing', p: 0.6 },
  { id: 'demo-read', name: 'Read', category: 'mind', p: 0.55 },
  { id: 'demo-call', name: 'Call a friend', category: 'people', p: 0.3 },
  { id: 'demo-journal', name: 'Journal', category: 'mind', p: 0.5 },
  { id: 'demo-tidy', name: 'Tidy up', category: 'other', p: 0.45 },
];

const HIGHLIGHTS = [
  'Long walk in the sun',
  'Finished a good chapter',
  'Cooked something new',
  'Quiet evening at home',
  'Got a tricky task done',
  'Coffee with a friend',
  'Tried a harder route',
  'Early start paid off',
  'Tidied the desk',
  'Nice call with family',
];

// Time categories. Ids are numeric strings because the Hours tab stores the id in each cell.
const TIME_CATEGORIES: string[][] = [
  ['0', 'sleep', '#0ea5e9', '0', 'sleep'],
  ['1', 'work', '#f59e0b', '1', 'work'],
  ['4', 'exercise', '#ef4444', '2', 'body'],
  ['5', 'friends', '#eab308', '3', 'people'],
  ['11', 'misc', '#64748b', '4', 'admin'],
];

/** The category id for an hour of a day. */
function hourCategory(h: number, workday: boolean, evening: string): string {
  if (h < 7 || h >= 23) return '0';
  if (workday && h >= 9 && h < 17) return '1';
  if (h === 7 || h === 8) return '11';
  if (h >= 18 && h < 20) return evening;
  return '11';
}

export function demoSeed(today: string): Record<string, string[][]> {
  const rand = mulberry32(hashString(`demo:${today}`));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const chance = (p: number) => rand() < p;

  const out = {} as Record<TabKey, string[][]>;
  for (const k of Object.keys(TABS) as TabKey[]) out[k] = [];

  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i - (DAYS - 1)));
  // Today stays empty so a visitor's first log shows up right away.
  const past = dates.filter((d) => d !== today);
  const hardMonday = addDays(mondayOf(today), -35);
  const hardWeek = new Set(Array.from({ length: 7 }, (_, i) => addDays(hardMonday, i)));
  const betterWeek = new Set(Array.from({ length: 7 }, (_, i) => addDays(hardMonday, 7 + i)));

  // Activities: id, name, status, category.
  out.activities = HABITS.map((h) => [h.id, h.name, 'active', h.category]);

  // Logs: date, activityId, '1' or '0'. A few whole days are left unlogged (gaps); a done habit
  // is more likely again the next day (streaks).
  const prev: Record<string, boolean> = {};
  for (const date of past) {
    if (chance(0.07)) { for (const h of HABITS) prev[h.id] = false; continue; }
    for (const h of HABITS) {
      let p = h.p + (prev[h.id] ? 0.2 : -0.05);
      if (hardWeek.has(date)) p *= 0.4;
      const done = chance(Math.min(0.95, Math.max(0.05, p)));
      prev[h.id] = done;
      out.logs.push([date, h.id, done ? '1' : '0']);
    }
  }

  // Moods: date, whole number. Mostly 6-8, one hard week (3-4), then a better one (6-8).
  for (const date of past) {
    let score: number;
    if (hardWeek.has(date)) score = pick([3, 4, 4]);
    else if (betterWeek.has(date)) score = pick([6, 7, 7, 8]);
    else score = pick([6, 6, 7, 7, 7, 8, 8, 5, 9]);
    out.moods.push([date, String(score)]);
  }

  // Highlights on about one day in four.
  for (const date of past) if (chance(0.25)) out.highlights.push([date, pick(HIGHLIGHTS)]);

  // Weights: about weekly, a slow drift, one decimal.
  let weight = 78 + Math.floor(rand() * 5);
  for (let i = 0; i < past.length; i += 7) {
    weight = Math.round((weight + (rand() - 0.55) * 0.8) * 10) / 10;
    out.weights.push([past[i], weight.toFixed(1)]);
  }

  // Time categories and the last 60 days of hours: date, then h1..h24 holding a category id (hour 0 = h1).
  out.timeCategories = TIME_CATEGORIES;
  for (const date of past.slice(-60)) {
    const dow = weekday(date);
    const workday = dow >= 1 && dow <= 5;
    const evening = pick(['4', '5', '4', '11']);
    out.hours.push([date, ...Array.from({ length: 24 }, (_, h) => hourCategory(h, workday, evening))]);
  }

  // Climbs: id, date, session, type, grade, attempts, location, notes. About one session a week.
  let session = 0;
  let climbId = 0;
  for (let i = 3; i < dates.length; i += 7) {
    const date = addDays(dates[i], Math.floor(rand() * 3));
    if (date >= today) continue;
    session += 1;
    const routes = 3 + Math.floor(rand() * 3);
    for (let r = 0; r < routes; r++) {
      climbId += 1;
      out.climbs.push([
        `demo-climb-${climbId}`, date, String(session), 'boulder', `V${1 + Math.floor(rand() * 4)}`,
        String(1 + Math.floor(rand() * 4)), 'City Wall', r === 0 && chance(0.3) ? 'Felt strong' : '',
      ]);
    }
  }
  out.climbGoals = [['demo-goal-1', today.slice(0, 4), 'boulder', 'V3', '20']];

  // Sidequests: id, title, type, year, unit, target, milestones JSON, description, createdAt, completedAt.
  const year = today.slice(0, 4);
  const created = dates[Math.max(0, dates.length - 150)];
  const m1 = addDays(today, -40);
  const m2 = addDays(today, -12);
  out.sidequests = [
    ['demo-sq-books', 'Read 12 books', 'count', year, 'books', '12', '', 'One book a month', created, ''],
    [
      'demo-sq-song', 'Learn a song', 'milestone', year, '', '',
      JSON.stringify([{ label: 'Learn the chords', completedAt: m1 }, { label: 'Play the verse', completedAt: m2 }, { label: 'Play it all' }]),
      'Slowly, one part at a time', created, '',
    ],
  ];
  // Sidequest logs: id, sidequestId, date, value, value2, note, milestoneIndex.
  out.sidequestLogs = [
    ['demo-sql-1', 'demo-sq-books', addDays(today, -120), '1', '', 'First one done', ''],
    ['demo-sql-2', 'demo-sq-books', addDays(today, -85), '1', '', '', ''],
    ['demo-sql-3', 'demo-sq-books', addDays(today, -50), '1', '', '', ''],
    ['demo-sql-4', 'demo-sq-books', addDays(today, -18), '1', '', '', ''],
    ['demo-sql-5', 'demo-sq-song', m1, '', '', '', '0'],
    ['demo-sql-6', 'demo-sq-song', m2, '', '', '', '1'],
  ];

  // Settings: the game counts as imported; the owner is claimed at first use.
  out.settings = [['gameImported', '1'], ['ownerEmail', '']];

  // DayLogs and DayScores stay empty: the game locks closed days itself on the first read.
  const result: Record<string, string[][]> = {};
  for (const k of Object.keys(TABS) as TabKey[]) result[TABS[k]] = [HEADERS[k], ...out[k]];
  return result;
}
