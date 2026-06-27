import { google } from 'googleapis';
import type { ClimbLog, ClimbGoal, HourLog } from '@/lib/types';

export type SheetAuth = {
  spreadsheetId: string;
};

// Service-account auth: one robot account reads/writes every user's sheet.
// Users share their own sheet with this account's email. Cached on globalThis so
// the JWT client (and its internally-managed access token) is reused across requests.
const globalAuthKey = '__sheetsServiceClient';

function getPrivateKey(): string {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  // Vercel/env files store the PEM with literal "\n" sequences; restore real newlines.
  return key.replace(/\\n/g, '\n');
}

export function getServiceSheets() {
  const g = globalThis as typeof globalThis & {
    [globalAuthKey]?: ReturnType<typeof google.sheets>;
  };
  if (!g[globalAuthKey]) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: getPrivateKey(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    g[globalAuthKey] = google.sheets({ version: 'v4', auth });
  }
  return g[globalAuthKey];
}

// Kept name/signature so existing call sites are unchanged; auth no longer comes
// from `sa` (the service account handles it), only the spreadsheetId is used.
function getOAuthSheets(_sa: SheetAuth) {
  return getServiceSheets();
}

// Known tabs cache keyed by spreadsheetId — persists across hot reloads via globalThis
const globalKey = '__knownSheets';
function getKnownSheets(spreadsheetId: string): Set<string> {
  const g = globalThis as typeof globalThis & { [globalKey]?: Map<string, Set<string>> };
  if (!g[globalKey]) g[globalKey] = new Map<string, Set<string>>();
  if (!g[globalKey].has(spreadsheetId)) g[globalKey].set(spreadsheetId, new Set<string>());
  return g[globalKey].get(spreadsheetId)!;
}

async function ensureSheetExists(sa: SheetAuth, title: string, headers?: string[]) {
  const known = getKnownSheets(sa.spreadsheetId);
  if (known.has(title)) return;

  try {
    const sheets = getOAuthSheets(sa);
    const spreadsheetId = sa.spreadsheetId;
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const existing = (meta.data.sheets || []).some((s) => s.properties?.title === title);
    if (!existing) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      if (headers?.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${title}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        });
      }
    }
    known.add(title);
  } catch (error: unknown) {
    const status = (error as Record<string, unknown>)?.status;
    const code = (error as Record<string, unknown>)?.code;
    if (status === 429 || code === 429) { known.add(title); return; }
    throw error;
  }
}

// ── Activities ──────────────────────────────────────────────

export async function listActivities(sa: SheetAuth, account: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Activities_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'status']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  return (res.data.values || [])
    .filter((row) => row && row[0] && String(row[0]).trim() !== '')
    .map(([id, name, status]) => ({
      id: String(id).trim(),
      name: String(name || '').trim(),
      status: String(status || 'active').trim() || 'active',
    }));
}

export async function createActivity(sa: SheetAuth, account: string, name: string, options?: { status?: 'active' | 'stopped' }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Activities_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'status']);
  const id = String(Date.now());
  const status = options?.status ?? 'active';
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${title}!A1:C`, valueInputOption: 'RAW',
    requestBody: { values: [[id, name, status]] },
  });
  return { id, name, status };
}

export async function updateActivity(sa: SheetAuth, account: string, id: string, updates: { name?: string; status?: 'active' | 'stopped' }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Activities_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'status']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  const existing = values[rowIndex - 2] || [];
  const name = updates.name ?? existing[1] ?? '';
  const status = updates.status ?? (existing[2] || 'active');
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: `${title}!B${rowIndex}:C${rowIndex}`, valueInputOption: 'RAW',
    requestBody: { values: [[name, status]] },
  });
  return { id, name: String(name), status: String(status) };
}

export async function deleteActivity(sa: SheetAuth, account: string, id: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Activities_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'status']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
    });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:C${rowIndex}` });
  }
  return { id };
}

// ── Activity Logs ────────────────────────────────────────────

export async function appendLog(sa: SheetAuth, account: string, dateISO: string, activityId: string, completed: boolean) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Logs_${account}`;
  await ensureSheetExists(sa, title, ['date', 'activityId', 'completed']);
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${title}!A1:C`, valueInputOption: 'RAW',
    requestBody: { values: [[dateISO, activityId, completed ? '1' : '0']] },
  });
}

export async function getLogsForDate(sa: SheetAuth, account: string, dateISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Logs_${account}`;
  await ensureSheetExists(sa, title, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  return (res.data.values || [])
    .map(([date, activityId, completed]) => ({
      date: String(date).trim(),
      activityId: String(activityId).trim(),
      completed: String(completed).trim() === '1',
    }))
    .filter((row) => row.date === dateISO);
}

export async function getLogsBetween(sa: SheetAuth, account: string, fromISO: string, toISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Logs_${account}`;
  await ensureSheetExists(sa, title, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return (res.data.values || [])
    .map(([date, activityId, completed]) => ({
      date: String(date).trim(),
      activityId: String(activityId).trim(),
      completed: String(completed).trim() === '1',
    }))
    .filter(({ date }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to;
    });
}

// ── Highlights ───────────────────────────────────────────────

export async function setHighlight(sa: SheetAuth, account: string, dateISO: string, text: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Highlights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'text']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${title}!A1:B`, valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, text]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!B${rowIndex}`, valueInputOption: 'RAW',
      requestBody: { values: [[text]] },
    });
  }
}

export async function getHighlight(sa: SheetAuth, account: string, dateISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Highlights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'text']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  for (const row of (res.data.values || [])) {
    if (row[0] === dateISO) return String(row[1] || '');
  }
  return '';
}

export async function getHighlightsBetween(sa: SheetAuth, account: string, fromISO: string, toISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Highlights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'text']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return (res.data.values || [])
    .map(([date, text]) => ({ date: String(date).trim(), text: String(text ?? '').trim() }))
    .filter(({ date }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to;
    });
}

// ── Weights ──────────────────────────────────────────────────

export async function getWeight(sa: SheetAuth, account: string, dateISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Weights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  for (const row of (res.data.values || [])) {
    if (row[0] === dateISO) {
      const w = parseFloat(String(row[1] || '').trim());
      return Number.isFinite(w) ? w : null;
    }
  }
  return null;
}

export async function setWeight(sa: SheetAuth, account: string, dateISO: string, weight: number) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Weights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${title}!A1:B`, valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, String(weight)]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!B${rowIndex}`, valueInputOption: 'RAW',
      requestBody: { values: [[String(weight)]] },
    });
  }
}

export async function getWeightsBetween(sa: SheetAuth, account: string, fromISO: string, toISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Weights_${account}`;
  await ensureSheetExists(sa, title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return (res.data.values || [])
    .map(([date, weight]) => ({
      date: String(date).trim(),
      weight: parseFloat(String(weight ?? '').trim()),
    }))
    .filter(({ date, weight }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to && Number.isFinite(weight);
    });
}

// ── Moods ────────────────────────────────────────────────────

export async function getMood(sa: SheetAuth, account: string, dateISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Moods_${account}`;
  await ensureSheetExists(sa, title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  for (const row of (res.data.values || [])) {
    if (row[0] === dateISO) {
      const s = parseInt(String(row[1] || '').trim(), 10);
      return Number.isFinite(s) ? s : null;
    }
  }
  return null;
}

export async function setMood(sa: SheetAuth, account: string, dateISO: string, score: number) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Moods_${account}`;
  await ensureSheetExists(sa, title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${title}!A1:B`, valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, String(score)]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${title}!B${rowIndex}`, valueInputOption: 'RAW',
      requestBody: { values: [[String(score)]] },
    });
  }
}

export async function getMoodsBetween(sa: SheetAuth, account: string, fromISO: string, toISO: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Moods_${account}`;
  await ensureSheetExists(sa, title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return (res.data.values || [])
    .map(([date, score]) => ({
      date: String(date).trim(),
      score: parseInt(String(score ?? '').trim(), 10),
    }))
    .filter(({ date, score }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to && Number.isFinite(score);
    });
}

// ── Consistency Metrics ──────────────────────────────────────

export async function getConsistencyMetrics(sa: SheetAuth, account: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const logsTitle = `Logs_${account}`;
  const actsTitle = `Activities_${account}`;
  await ensureSheetExists(sa, logsTitle, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${logsTitle}!A2:C` });
  const values = res.data.values || [];
  await ensureSheetExists(sa, actsTitle, ['id', 'name']);
  const activitiesRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${actsTitle}!A2:B` });
  const activities = (activitiesRes.data.values || []).map(([id, name]) => ({ id, name }));
  const activityCount = activities.length;
  const activityMap: Record<string, { id: string; name: string }> = {};
  for (const a of activities) activityMap[a.id] = { id: a.id, name: a.name };

  const byWeek: Record<string, { done: number; total: number; firstDate?: Date }> = {};
  const completedDates = new Set<string>();
  let totalCompletions = 0;

  for (const [dateISO, _activityId, completed] of values) {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) continue;
    const weekKey = `${d.getUTCFullYear()}-W${getWeekNumber(d)}`;
    const bucket = (byWeek[weekKey] ||= { done: 0, total: 0, firstDate: d });
    bucket.total += 1;
    if (!bucket.firstDate || d < bucket.firstDate) bucket.firstDate = d;
    if (completed === '1') {
      bucket.done += 1;
      totalCompletions += 1;
      completedDates.add(dateISO);
    }
  }

  const weeks = Object.entries(byWeek)
    .map(([week, { done, total, firstDate }]) => {
      const start = firstDate ? getIsoWeekStart(firstDate) : undefined;
      const end = start ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6)) : undefined;
      const expectedDays = computeExpectedDaysInWeek(start, end);
      const expectedTotal = activityCount > 0 ? expectedDays * activityCount : total;
      const rate = expectedTotal ? done / expectedTotal : 0;
      return { week, done, total: expectedTotal, rate, date: start ? start.toISOString().slice(0, 10) : undefined };
    })
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const weeksWithAvg = weeks as Array<typeof weeks[number] & { movingAvg4: number }>;
  for (let i = 0; i < weeksWithAvg.length; i++) {
    const slice = weeksWithAvg.slice(Math.max(0, i - 3), i + 1);
    weeksWithAvg[i].movingAvg4 = slice.reduce((acc, w) => acc + w.rate, 0) / slice.length;
  }

  const avgRate = weeks.length ? weeks.reduce((acc, w) => acc + w.rate, 0) / weeks.length : 0;
  let bestWeek: { week: string; rate: number } | null = null;
  for (const w of weeks) {
    if (!bestWeek || w.rate > bestWeek.rate) bestWeek = { week: w.week, rate: w.rate };
  }
  const currentStreakDays = computeCurrentStreakDays(completedDates);

  const byActivityWeek: Record<string, Record<string, { done: number }>> = {};
  for (const [dateISO, activityId, completed] of values) {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) continue;
    const weekKey = `${d.getUTCFullYear()}-W${getWeekNumber(d)}`;
    const act = (byActivityWeek[activityId] ||= {});
    const bucket = (act[weekKey] ||= { done: 0 });
    if (completed === '1') bucket.done += 1;
  }

  const weeksMap = new Map(weeks.map((w) => [w.week, w]));
  const byActivity = Object.entries(byActivityWeek).map(([activityId, actWeeksMap]) => {
    const label = activityMap[activityId]?.name || activityId;
    const activityWeeks = Object.entries(actWeeksMap).map(([weekKey, agg]) => {
      const overall = weeksMap.get(weekKey);
      const expectedDays = overall ? Math.max(1, Math.min(7, Math.round((overall.total || 0) / Math.max(1, activityCount)))) : 7;
      return { week: weekKey, done: agg.done, total: expectedDays, rate: expectedDays ? agg.done / expectedDays : 0 };
    }).sort((a, b) => a.week.localeCompare(b.week));
    return { id: activityId, name: label, weeks: activityWeeks };
  });

  return { weeks, byActivity, summary: { avgRate, bestWeek, currentStreakDays, totalCompletions } };
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getIsoWeekStart(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

function computeExpectedDaysInWeek(start?: Date, end?: Date) {
  if (!start || !end) return 0;
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  if (end < today) return 7;
  if (start > today) return 0;
  return Math.min(7, Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1));
}

function computeCurrentStreakDays(completedDates: Set<string>) {
  let streak = 0;
  const toISO = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
  let cursor = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  while (completedDates.has(toISO(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ── Climbing ─────────────────────────────────────────────────

export async function listClimbLogs(sa: SheetAuth, account: string, fromISO?: string, toISO?: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Climbs_${account}`;
  await ensureSheetExists(sa, title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:H` });
  const rows: ClimbLog[] = (res.data.values || [])
    .filter((r) => r && r[0])
    .map(([id, date, session, type, grade, attempts, location, notes]) => ({
      id: String(id).trim(),
      date: String(date).trim(),
      session: parseInt(String(session ?? '0'), 10) || 0,
      type: (String(type || 'boulder').trim().toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope',
      grade: String(grade || '').trim(),
      attempts: parseInt(String(attempts ?? '0'), 10) || 0,
      location: String(location || '').trim() || undefined,
      notes: String(notes || '').trim() || undefined,
    }));
  if (!fromISO || !toISO) return rows;
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return rows.filter((r) => { const t = new Date(r.date).getTime(); return !Number.isNaN(t) && t >= from && t <= to; });
}

export async function addClimbLog(sa: SheetAuth, account: string, entry: { date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Climbs_${account}`;
  await ensureSheetExists(sa, title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
  const id = String(Date.now());
  await sheets.spreadsheets.values.append({
    spreadsheetId, range: `${title}!A1:H`, valueInputOption: 'RAW',
    requestBody: { values: [[id, entry.date, String(entry.session || 0), entry.type, entry.grade, String(entry.attempts || 0), String(entry.location || ''), String(entry.notes || '')]] },
  });
  return { id, ...entry } as ClimbLog;
}

export async function deleteClimbLog(sa: SheetAuth, account: string, id: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Climbs_${account}`;
  await ensureSheetExists(sa, title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:H` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { id };
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] } });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:H${rowIndex}` });
  }
  return { id };
}

export async function listClimbGoals(sa: SheetAuth, account: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(sa, title, ['id', 'year', 'type', 'grade', 'target']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:E` });
  return (res.data.values || []).filter((r) => r && r[0]).map(([id, year, type, grade, target]) => ({
    id: String(id).trim(),
    year: parseInt(String(year ?? '0'), 10) || new Date().getFullYear(),
    type: (String(type || 'boulder').trim().toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope',
    grade: String(grade || '').trim(),
    target: parseInt(String(target ?? '0'), 10) || 0,
  })) as ClimbGoal[];
}

export async function upsertClimbGoal(sa: SheetAuth, account: string, goal: { year: number; type: 'boulder' | 'rope'; grade: string; target: number }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(sa, title, ['id', 'year', 'type', 'grade', 'target']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:E` });
  const values = res.data.values || [];
  let rowIndex = -1; let existingId = '';
  for (let i = 0; i < values.length; i++) {
    const [id, year, type, grade] = values[i];
    if (parseInt(String(year ?? '0'), 10) === goal.year && String(type || '').trim().toLowerCase() === goal.type && String(grade || '').trim().toLowerCase() === goal.grade.trim().toLowerCase()) {
      rowIndex = i + 2; existingId = id; break;
    }
  }
  if (rowIndex === -1) {
    const id = String(Date.now());
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:E`, valueInputOption: 'RAW', requestBody: { values: [[id, String(goal.year), goal.type, goal.grade, String(goal.target)]] } });
    return { id, ...goal } as ClimbGoal;
  }
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!E${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[String(goal.target)]] } });
  return { id: existingId, ...goal } as ClimbGoal;
}

export async function deleteClimbGoal(sa: SheetAuth, account: string, id: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(sa, title, ['id', 'year', 'type', 'grade', 'target']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:E` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { id };
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] } });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:E${rowIndex}` });
  }
  return { id };
}

// ── Time Tracking ────────────────────────────────────────────

function hourIndexToColumnLetter(hourIndex: number) {
  let n = 2 + hourIndex;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export async function listHourLogs(sa: SheetAuth, account: string, fromISO?: string, toISO?: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(sa, title, headers);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const expand: HourLog[] = [];
  for (const row of (res.data.values || [])) {
    if (!row || !row[0]) continue;
    const date = String(row[0]).trim();
    for (let h = 0; h < 24; h++) {
      const v = row[1 + h];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const category = parseInt(String(v).trim(), 10);
        if (Number.isFinite(category)) expand.push({ id: `${date}-${h}`, date, hour: h, category });
      }
    }
  }
  if (!fromISO || !toISO) return expand;
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return expand.filter((r) => { const t = new Date(r.date).getTime(); return !Number.isNaN(t) && t >= from && t <= to; });
}

export async function upsertHourLog(sa: SheetAuth, account: string, entry: { date: string; hour: number; category: number }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(sa, title, headers);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String((values[i] && values[i][0]) || '').trim() === entry.date) { rowIndex = i + 2; break; }
  }
  const colLetter = hourIndexToColumnLetter(entry.hour);
  if (rowIndex === -1) {
    const row = new Array(25).fill('');
    row[0] = entry.date; row[1 + entry.hour] = String(entry.category);
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:Y`, valueInputOption: 'RAW', requestBody: { values: [row] } });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!${colLetter}${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[String(entry.category)]] } });
  }
  return { id: `${entry.date}-${entry.hour}`, ...entry } as HourLog;
}

export async function deleteHourLog(_sa: SheetAuth, _account: string, id: string) {
  return { id };
}

export async function upsertHourLogsBatch(sa: SheetAuth, account: string, entry: { date: string; entries: Array<{ hour: number; category: number }> }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(sa, title, headers);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String((values[i] && values[i][0]) || '').trim() === entry.date) { rowIndex = i + 2; break; }
  }
  let rowHours: string[] = new Array(24).fill('');
  if (rowIndex !== -1) {
    const existing = values[rowIndex - 2] || [];
    for (let h = 0; h < 24; h++) {
      const v = existing[1 + h];
      rowHours[h] = (v !== undefined && v !== null && String(v).trim() !== '') ? String(v).trim() : '';
    }
  }
  for (const e of entry.entries) {
    if (Number.isFinite(e.hour) && e.hour >= 0 && e.hour <= 23 && Number.isFinite(e.category)) {
      rowHours[e.hour] = String(e.category);
    }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:Y`, valueInputOption: 'RAW', requestBody: { values: [[entry.date, ...rowHours]] } });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!B${rowIndex}:Y${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [rowHours] } });
  }
  return { date: entry.date, count: entry.entries.length };
}

// ── Time Categories ──────────────────────────────────────────

export type TimeCategory = { id: string; name: string; color: string; order: number };

export async function listTimeCategories(sa: SheetAuth, account: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'color', 'order']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  if (values.length === 0) {
    const defaults: TimeCategory[] = [
      { id: '0', name: 'sleep', color: '#0ea5e9', order: 0 },
      { id: '1', name: 'work', color: '#f59e0b', order: 1 },
      { id: '2', name: 'hobbies / projects', color: '#22c55e', order: 2 },
      { id: '3', name: 'freelance', color: '#a855f7', order: 3 },
      { id: '4', name: 'exercise', color: '#ef4444', order: 4 },
      { id: '5', name: 'friends', color: '#eab308', order: 5 },
      { id: '6', name: 'relaxation and leisure', color: '#14b8a6', order: 6 },
      { id: '7', name: 'partner', color: '#fb7185', order: 7 },
      { id: '8', name: 'family', color: '#8b5cf6', order: 8 },
      { id: '9', name: 'productive / chores', color: '#06b6d4', order: 9 },
      { id: '10', name: 'travel', color: '#f97316', order: 10 },
      { id: '11', name: 'misc', color: '#64748b', order: 11 },
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${title}!A1:D`, valueInputOption: 'RAW',
      requestBody: { values: defaults.map((c) => [c.id, c.name, c.color, String(c.order)]) },
    });
    return defaults;
  }
  const rows: TimeCategory[] = values
    .filter((r) => r && r[0])
    .map(([id, name, color, order], i) => ({
      id: String(id).trim(),
      name: String(name || '').trim(),
      color: String(color || '').trim() || '#888888',
      order: Number.isFinite(parseInt(String(order ?? ''), 10)) ? parseInt(String(order ?? ''), 10) : i,
    }))
    .sort((a, b) => a.order - b.order);
  if (!rows.some((r) => r.id === '11')) {
    const misc: TimeCategory = { id: '11', name: 'misc', color: '#64748b', order: 11 };
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:D`, valueInputOption: 'RAW', requestBody: { values: [[misc.id, misc.name, misc.color, String(misc.order)]] } });
    rows.push(misc);
    rows.sort((a, b) => a.order - b.order);
  }
  return rows;
}

export async function upsertTimeCategory(sa: SheetAuth, account: string, entry: { id?: string; name: string; color: string; order?: number }) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'color', 'order']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1; let existingId = '';
  if (entry.id) {
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim() === entry.id) { rowIndex = i + 2; existingId = entry.id; break; }
    }
  }
  const id = existingId || String(Date.now());
  const name = String(entry.name || '').trim();
  const color = String(entry.color || '').trim() || '#888888';
  const order = Number.isFinite(entry.order) ? Number(entry.order) : (values.length + 1);
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:D`, valueInputOption: 'RAW', requestBody: { values: [[id, name, color, String(order)]] } });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!B${rowIndex}:D${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[name, color, String(order)]] } });
  }
  return { id, name, color, order } as TimeCategory;
}

export async function deleteTimeCategory(sa: SheetAuth, account: string, id: string) {
  const sheets = getOAuthSheets(sa);
  const { spreadsheetId } = sa;
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(sa, title, ['id', 'name', 'color', 'order']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { id };
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] } });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:D${rowIndex}` });
  }
  return { id };
}
