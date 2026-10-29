import { getServiceSheets, tabCache } from '@/lib/googleSheets';
import type { SheetAuth } from '@/lib/googleSheets';
import { range, TABS } from '@/lib/sheetLayout';
import { withLock } from '@/lib/keyedLock';
import { dayValueRows } from '@/lib/sidequestDay';
import type { Sidequest, SidequestLog, SidequestMilestone, SidequestType } from '@/lib/types';

// ── Sidequests CRUD ──────────────────────────────────────────
// Tab names come from lib/sheetLayout.ts; the tabs are created by ensureCoreTabs.

function rowToSq(row: string[]): Sidequest {
  const [id, title, type, year, unit, target, milestonesJson, description, createdAt, completedAt] = row;
  let milestones: SidequestMilestone[] | undefined;
  try { milestones = milestonesJson ? JSON.parse(milestonesJson) : undefined; } catch { milestones = undefined; }
  return {
    id: String(id || '').trim(),
    title: String(title || '').trim(),
    type: (String(type || 'oneoff').trim() as SidequestType),
    year: parseInt(String(year || new Date().getFullYear()), 10) || new Date().getFullYear(),
    unit: String(unit || '').trim() || undefined,
    target: target ? (parseFloat(String(target)) || undefined) : undefined,
    milestones,
    description: String(description || '').trim() || undefined,
    createdAt: String(createdAt || '').trim(),
    completedAt: String(completedAt || '').trim() || undefined,
  };
}

function rowToLog(row: string[]): SidequestLog {
  const [id, sidequestId, date, value, value2, note, milestoneIndex] = row;
  return {
    id: String(id || '').trim(),
    sidequestId: String(sidequestId || '').trim(),
    date: String(date || '').trim(),
    value: value ? (parseFloat(String(value)) || undefined) : undefined,
    value2: value2 ? (parseFloat(String(value2)) || undefined) : undefined,
    note: String(note || '').trim() || undefined,
    milestoneIndex: milestoneIndex !== '' && milestoneIndex !== undefined
      ? (n => isNaN(n) ? undefined : n)(parseInt(String(milestoneIndex), 10)) : undefined,
  };
}

function rowsToSidequests(rows: readonly (readonly string[])[]): Sidequest[] {
  return rows.filter((r) => r && r[0]).map((r) => rowToSq(r.map(String)));
}

export async function listSidequests(sa: SheetAuth, year?: number): Promise<Sidequest[]> {
  const all = rowsToSidequests(await tabCache.readOne(sa.spreadsheetId, 'sidequests'));
  return year ? all.filter((sq) => sq.year === year) : all;
}

export async function getSidequest(sa: SheetAuth, id: string): Promise<Sidequest | null> {
  const all = rowsToSidequests(await tabCache.readOne(sa.spreadsheetId, 'sidequests'));
  return all.find((sq) => sq.id === id) || null;
}

export async function createSidequest(sa: SheetAuth, data: Omit<Sidequest, 'id' | 'createdAt'>): Promise<Sidequest> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequests;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const id = String(Date.now());
      const createdAt = new Date().toISOString().slice(0, 10);
      const row = [
        id, data.title, data.type, String(data.year),
        data.unit || '', data.target != null ? String(data.target) : '',
        data.milestones ? JSON.stringify(data.milestones) : '',
        data.description || '', createdAt, data.completedAt || '',
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: range(title, 'A1:J'), valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
      return { ...data, id, createdAt };
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequests');
    }
  });
}

export async function updateSidequest(sa: SheetAuth, id: string, patch: Partial<Sidequest>): Promise<Sidequest | null> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequests;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(title, 'A2:J') });
      const values = res.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === id) { rowIndex = i + 2; break; }
      }
      if (rowIndex === -1) return null;
      const existing = rowToSq(values[rowIndex - 2].map(String));
      const updated = { ...existing, ...patch, id };
      const row = [
        updated.id, updated.title, updated.type, String(updated.year),
        updated.unit || '', updated.target != null ? String(updated.target) : '',
        updated.milestones ? JSON.stringify(updated.milestones) : '',
        updated.description || '', updated.createdAt, updated.completedAt || '',
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: range(title, `A${rowIndex}:J${rowIndex}`), valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
      return updated;
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequests');
    }
  });
}

export async function deleteSidequest(sa: SheetAuth, id: string): Promise<void> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequests;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(title, 'A2:J') });
      const values = res.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === id) { rowIndex = i + 2; break; }
      }
      if (rowIndex === -1) return;
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
      const sheetId = sheet?.properties?.sheetId;
      if (typeof sheetId === 'number') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
        });
      } else {
        await sheets.spreadsheets.values.clear({ spreadsheetId, range: range(title, `A${rowIndex}:J${rowIndex}`) });
      }
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequests');
    }
  });
}

// ── Sidequest Logs ───────────────────────────────────────────

export async function listSidequestLogs(sa: SheetAuth, sidequestId?: string): Promise<SidequestLog[]> {
  const { spreadsheetId } = sa;
  const rows = (await tabCache.readOne(spreadsheetId, 'sidequestLogs')).filter((r) => r && r[0]);
  const all = rows.map((r) => rowToLog(r.map(String)));
  return sidequestId ? all.filter((l) => l.sidequestId === sidequestId) : all;
}

export async function addSidequestLog(sa: SheetAuth, entry: Omit<SidequestLog, 'id'>): Promise<SidequestLog> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequestLogs;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const id = String(Date.now());
      const row = [
        id, entry.sidequestId, entry.date,
        entry.value != null ? String(entry.value) : '',
        entry.value2 != null ? String(entry.value2) : '',
        entry.note || '',
        entry.milestoneIndex != null ? String(entry.milestoneIndex) : '',
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: range(title, 'A1:G'), valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
      return { ...entry, id };
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequestLogs');
    }
  });
}

/**
 * Sets one quest's value for one day: updates that day's first value row, clears any extra ones,
 * or appends a row when there is none. Milestone rows are never touched. Safe to replay.
 */
export async function setSidequestDayValue(
  sa: SheetAuth, sidequestId: string, date: string, value: number,
): Promise<SidequestLog> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequestLogs;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(title, 'A2:G') });
      const values = res.data.values || [];
      const [first, ...extra] = dayValueRows(values, sidequestId, date);
      if (first === undefined) {
        const id = String(Date.now());
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: range(title, 'A1:G'), valueInputOption: 'RAW',
          requestBody: { values: [[id, sidequestId, date, String(value), '', '', '']] },
        });
        return { id, sidequestId, date, value };
      }
      const existing = rowToLog(values[first - 2].map(String));
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: range(title, `D${first}`), valueInputOption: 'RAW',
        requestBody: { values: [[String(value)]] },
      });
      if (extra.length) {
        await sheets.spreadsheets.values.batchClear({
          spreadsheetId, requestBody: { ranges: extra.map((r) => range(title, `A${r}:G${r}`)) },
        });
      }
      return { ...existing, value };
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequestLogs');
    }
  });
}

export async function deleteSidequestLog(sa: SheetAuth, logId: string): Promise<void> {
  const sheets = getServiceSheets();
  const { spreadsheetId } = sa;
  const title = TABS.sidequestLogs;
  return withLock(`${spreadsheetId}:${title}`, async () => {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: range(title, 'A2:G') });
      const values = res.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (values[i][0] === logId) { rowIndex = i + 2; break; }
      }
      if (rowIndex === -1) return;
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
      const sheetId = sheet?.properties?.sheetId;
      if (typeof sheetId === 'number') {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
        });
      } else {
        await sheets.spreadsheets.values.clear({ spreadsheetId, range: range(title, `A${rowIndex}:G${rowIndex}`) });
      }
    } finally {
      tabCache.invalidate(spreadsheetId, 'sidequestLogs');
    }
  });
}
