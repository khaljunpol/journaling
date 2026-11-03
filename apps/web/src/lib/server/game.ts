// Reads the sheet and works out the game and the World. Nothing is written until the history import
// has run (Settings gameImported = 1); after that, a run locks closed days and stores new plant slots.
import { dayScores, gameState, lockCursor, scoresToLock, type GameInput, type GameState } from '@journaling/core/game';
import { parseScoreRows, type ScoreRow } from '@journaling/core/ledger';
import { levelFor } from '@journaling/core/scoring';
import { assignSlots, buildWorld, worldSummary, worldTimeline, type PlantKind, type PlantRecord, type Timeline, type World, type WorldInput } from '@journaling/core/world';
import { categoryOf } from '@journaling/core/habitCategory';
import {
  appendDayScores, getLogsBetween, getMoodsBetween, getSettings, listActivities, listClimbGoals, listClimbLogs, listDayScores, listDayStamps, listFillMarks, listHourLogs, listTimeCategories, setSetting, tabCache,
  type SheetAuth,
} from '@journaling/sheets/googleSheets';
import { listSidequests } from '@journaling/sheets/sidequests';
import { gameSettings, parseWorldPlants } from './gameInput';

const KIND: Partial<Record<string, PlantKind>> = { move: 'tree', wellbeing: 'sun', other: 'bamboo' };

async function readCore(sa: SheetAuth, today: string) {
  await tabCache.read(sa.spreadsheetId, ['activities', 'logs', 'settings', 'dayLogs']);
  const [logs, activities, settings, stamps, fills] = await Promise.all([
    getLogsBetween(sa, '2000-01-01', today),
    listActivities(sa),
    getSettings(sa),
    listDayStamps(sa),
    listFillMarks(sa),
  ]);
  return { logs, activities, settings, stamps, fills };
}

/** Plant slots with any new habits added: stored records first, then habits by first log. */
function plantRecords(input: GameInput, stored: Record<string, PlantRecord>): Record<string, PlantRecord> {
  const first = new Map<string, string>();
  for (const l of input.logs) {
    const d = l.date.slice(0, 10);
    if (d <= input.today && (!first.has(l.activityId) || d < (first.get(l.activityId) as string))) first.set(l.activityId, d);
  }
  const kinds = new Map<string, { kind: PlantKind; name: string }>();
  for (const a of input.activities) {
    const k = KIND[categoryOf(a)];
    if (k) kinds.set(a.id, { kind: k, name: a.name });
  }
  return assignSlots(first, stored, kinds);
}

function worldInputFrom(input: GameInput, locked: Map<string, ScoreRow>, lockedTo: string | null, records: Record<string, PlantRecord>, extra?: Partial<Pick<WorldInput, 'climbs' | 'goals' | 'sidequests' | 'hours' | 'cats'>>): WorldInput {
  const days = dayScores({ ...input, locked, lockedTo, withZero: true });
  const points = days.reduce((n, d) => n + d.points, 0);
  return {
    today: input.today, logs: input.logs, activities: input.activities, records, days,
    climbs: extra?.climbs ?? [], goals: extra?.goals ?? [], sidequests: extra?.sidequests ?? [], hours: extra?.hours ?? [], cats: extra?.cats ?? [], level: levelFor(points).level,
  };
}

function worldFrom(...args: Parameters<typeof worldInputFrom>): World {
  return buildWorld(worldInputFrom(...args));
}

/** `import`: the one-time history import (the user's tap on "Count my history"). `read`: lock new closed days only if already imported. */
export async function loadGame(sa: SheetAuth, today: string, mode: 'read' | 'import'): Promise<GameState> {
  const { logs, activities, settings, stamps, fills } = await readCore(sa, today);
  const s = gameSettings(settings);
  const imported = s.imported || mode === 'import';
  const input = { today, logs, activities, templates: s.templates, stamps, fills };

  if (imported) {
    // The import starts from the first logged day; later runs continue after the cursor.
    const lockedTo = mode === 'import' ? null : s.lockedTo;
    const cursor = lockCursor(today);
    const due = scoresToLock({ ...input, lockedTo });
    if (due.length) await appendDayScores(sa, due, new Date().toISOString());
    if (s.lockedTo !== cursor && (!s.lockedTo || s.lockedTo < cursor)) await setSetting(sa, 'scoresLockedTo', cursor);
    if (mode === 'import' && !s.imported) await setSetting(sa, 'gameImported', '1');
  }

  const locked = imported ? parseScoreRows(await listDayScores(sa)) : new Map();
  // After a lock run every day up to the cursor is closed.
  const lockedTo = imported ? lockCursor(today) : null;
  const state = gameState({ ...input, locked, storedBadges: s.badges, imported, lockedTo });
  if (imported && Object.keys(state.badges).length !== Object.keys(s.badges).length) {
    await setSetting(sa, 'badges', JSON.stringify(state.badges));
  }
  // Plant slots are stored once, so a deleted habit keeps its plant and slots never move.
  const stored = parseWorldPlants(settings.worldPlants);
  const records = plantRecords(input, stored);
  if (imported && JSON.stringify(records) !== JSON.stringify(stored)) await setSetting(sa, 'worldPlants', JSON.stringify(records));
  // The World's one-line summary rides along, so Overview needs no second full read.
  // Climbing logs decide `climbed` (You hides a climbing habit's streak when the climbing log has its own).
  const climbs = await listClimbLogs(sa);
  return { ...state, world: worldSummary(worldFrom(input, locked, lockedTo, records, { climbs })) };
}

/** Everything the World is built from, read-only: never locks and never writes. New habits get their slot in memory until the next game run stores it. */
async function loadWorldInput(sa: SheetAuth, today: string): Promise<WorldInput> {
  await tabCache.read(sa.spreadsheetId, ['hours', 'timeCategories', 'climbs', 'climbGoals', 'sidequests', 'moods']);
  const [core, climbs, goals, sidequests, hours, cats, moods] = await Promise.all([readCore(sa, today), listClimbLogs(sa), listClimbGoals(sa), listSidequests(sa), listHourLogs(sa), listTimeCategories(sa), getMoodsBetween(sa, '2000-01-01', today)]);
  const s = gameSettings(core.settings);
  const input = { today, logs: core.logs, activities: core.activities, templates: s.templates, stamps: core.stamps, fills: core.fills };
  const locked = s.imported ? parseScoreRows(await listDayScores(sa)) : new Map();
  const records = plantRecords(input, parseWorldPlants(core.settings.worldPlants));
  return { ...worldInputFrom(input, locked, s.imported ? s.lockedTo : null, records, { climbs, goals, sidequests, hours, cats }), moods };
}

/** The World, read-only. */
export async function loadWorld(sa: SheetAuth, today: string): Promise<World> {
  return buildWorld(await loadWorldInput(sa, today));
}

/** The World and when each thing in it appeared (for "Watch your year"), read-only. */
export async function loadTimeline(sa: SheetAuth, today: string): Promise<Timeline> {
  return worldTimeline(await loadWorldInput(sa, today));
}
