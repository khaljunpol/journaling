// Reads the sheet and works out the game. With `lock`, closed days are appended to DayScores first.
// Nothing is written until the history import has run (Settings gameImported = 1).
import { gameState, lockCursor, scoresToLock, type GameState } from '@journaling/core/game';
import { parseScoreRows } from '@journaling/core/ledger';
import {
  appendDayScores, getLogsBetween, getSettings, listActivities, listDayScores, listDayStamps, listFillMarks, setSetting, tabCache, type SheetAuth,
} from '@journaling/sheets/googleSheets';
import { gameSettings } from './gameInput';

/** `import`: the one-time history import (the user's tap). `read`: lock new closed days only if already imported. */
export async function loadGame(sa: SheetAuth, today: string, mode: 'read' | 'import'): Promise<GameState> {
  await tabCache.read(sa.spreadsheetId, ['activities', 'logs', 'settings', 'dayLogs']);
  const [logs, activities, settings, stamps, fills] = await Promise.all([
    getLogsBetween(sa, '2000-01-01', today),
    listActivities(sa),
    getSettings(sa),
    listDayStamps(sa),
    listFillMarks(sa),
  ]);
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
  return state;
}
