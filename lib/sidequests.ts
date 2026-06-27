import { getServiceSheets } from '@/lib/googleSheets';
import type { SheetAuth } from '@/lib/googleSheets';
import type { Sidequest, SidequestLog, SidequestMilestone, SidequestType } from '@/lib/types';

// Sheet access uses the shared service account; `sa` only carries the spreadsheetId.
function getSheets(_sa: SheetAuth) {
  return getServiceSheets();
}

// ── Sheet helpers ────────────────────────────────────────────

// Cache confirmed-existing sheets so ensureSheet only hits the API once per process
const _sheetExistsCache = new Set<string>();

async function ensureSheet(sa: SheetAuth, title: string, headers: string[]) {
  const cacheKey = `${sa.spreadsheetId}::${title}`;
  if (_sheetExistsCache.has(cacheKey)) return;

  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const existing = (meta.data.sheets || []).map((s) => s.properties?.title);

  // Mark all known sheets as confirmed — avoid future checks for sibling sheets too
  for (const t of existing) { if (t) _sheetExistsCache.add(`${spreadsheetId}::${t}`); }

  if (!existing.includes(title)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!A1`, valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
  _sheetExistsCache.add(cacheKey);
}

// ── Sidequests CRUD ──────────────────────────────────────────

const SQ_HEADERS = ['id', 'title', 'type', 'year', 'unit', 'target', 'milestones', 'description', 'createdAt', 'completedAt'];
const SQ_LOG_HEADERS = ['id', 'sidequestId', 'date', 'value', 'value2', 'note', 'milestoneIndex'];

function sqTitle(account: string) { return `Sidequests_${account}`; }
function sqLogTitle(account: string) { return `SidequestLogs_${account}`; }

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

/** Ensures both sidequest sheets exist. Call once before parallel reads to avoid a race. */
export async function warmupSidequestSheets(sa: SheetAuth, account: string): Promise<void> {
  // A single spreadsheets.get populates the cache for all tabs at once.
  // Running ensureSheet for the first tab covers the second too (see cache logic above).
  await ensureSheet(sa, sqTitle(account), SQ_HEADERS);
  await ensureSheet(sa, sqLogTitle(account), SQ_LOG_HEADERS);
}

export async function listSidequests(sa: SheetAuth, account: string, year?: number): Promise<Sidequest[]> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqTitle(account);
  await ensureSheet(sa, title, SQ_HEADERS);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:J` });
  const rows = (res.data.values || []).filter((r) => r && r[0]);
  const all = rows.map((r) => rowToSq(r.map(String)));
  return year ? all.filter((sq) => sq.year === year) : all;
}

export async function getSidequest(sa: SheetAuth, account: string, id: string): Promise<Sidequest | null> {
  const all = await listSidequests(sa, account);
  return all.find((sq) => sq.id === id) || null;
}

export async function createSidequest(sa: SheetAuth, account: string, data: Omit<Sidequest, 'id' | 'createdAt'>): Promise<Sidequest> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqTitle(account);
  await ensureSheet(sa, title, SQ_HEADERS);
  const id = String(Date.now());
  const createdAt = new Date().toISOString().slice(0, 10);
  const row = [
    id, data.title, data.type, String(data.year),
    data.unit || '', data.target != null ? String(data.target) : '',
    data.milestones ? JSON.stringify(data.milestones) : '',
    data.description || '', createdAt, data.completedAt || '',
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${title}!A1:J`, valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return { ...data, id, createdAt };
}

export async function updateSidequest(sa: SheetAuth, account: string, id: string, patch: Partial<Sidequest>): Promise<Sidequest | null> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqTitle(account);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:J` });
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
    spreadsheetId, range: `${title}!A${rowIndex}:J${rowIndex}`, valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return updated;
}

export async function deleteSidequest(sa: SheetAuth, account: string, id: string): Promise<void> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqTitle(account);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:J` });
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
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:J${rowIndex}` });
  }
}

// ── Sidequest Logs ───────────────────────────────────────────

export async function listSidequestLogs(sa: SheetAuth, account: string, sidequestId?: string): Promise<SidequestLog[]> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqLogTitle(account);
  await ensureSheet(sa, title, SQ_LOG_HEADERS);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:G` });
  const rows = (res.data.values || []).filter((r) => r && r[0]);
  const all = rows.map((r) => rowToLog(r.map(String)));
  return sidequestId ? all.filter((l) => l.sidequestId === sidequestId) : all;
}

export async function addSidequestLog(sa: SheetAuth, account: string, entry: Omit<SidequestLog, 'id'>): Promise<SidequestLog> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqLogTitle(account);
  await ensureSheet(sa, title, SQ_LOG_HEADERS);
  const id = String(Date.now());
  const row = [
    id, entry.sidequestId, entry.date,
    entry.value != null ? String(entry.value) : '',
    entry.value2 != null ? String(entry.value2) : '',
    entry.note || '',
    entry.milestoneIndex != null ? String(entry.milestoneIndex) : '',
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${title}!A1:G`, valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return { ...entry, id };
}

export async function deleteSidequestLog(sa: SheetAuth, account: string, logId: string): Promise<void> {
  const sheets = getSheets(sa);
  const { spreadsheetId } = sa;
  const title = sqLogTitle(account);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:G` });
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
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:G${rowIndex}` });
  }
}
