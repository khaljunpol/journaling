import { google } from 'googleapis';

const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account env vars');
  }
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SPREADSHEET_ID');
  return id;
}

// Sheets confirmed to exist in this process — avoids redundant metadata fetches
const knownSheets = new Set<string>();

async function ensureSheetExists(title: string, headers?: string[]) {
  if (knownSheets.has(title)) return;

  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets || []).some((s) => s.properties?.title === title);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
    if (headers && headers.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  }

  knownSheets.add(title);
}

// Data model (separate tabs per account):
// - Sheet "Activities_<account>": columns [id, name, status, catalogId]
// - Sheet "Logs_<account>": columns [date ISO, activityId, completed]
// - Sheet "Highlights_<account>": columns [date ISO, text]
// Shared Catalog tab:
// - Sheet "Catalog": columns [id, name, category, tags]

export async function listActivities(account: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'status', 'catalogId']);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A2:D`,
  });
  const values = res.data.values || [];
  return values
    .filter((row) => row && row[0] && String(row[0]).trim() !== '')
    .map(([id, name, status, catalogId]) => ({
      id: String(id).trim(),
      name: String(name || '').trim(),
      status: String(status || 'active').trim() || 'active',
      catalogId: String(catalogId || '').trim() || undefined,
    }));
}

export async function createActivity(account: string, name: string, options?: { status?: 'active' | 'stopped'; catalogId?: string }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'status', 'catalogId']);
  const id = String(Date.now());
  const status = options?.status ?? 'active';
  const catalogId = options?.catalogId ?? '';
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1:D`,
    valueInputOption: 'RAW',
    requestBody: { values: [[id, name, status, catalogId]] },
  });
  return { id, name, status, catalogId: catalogId || undefined };
}

export async function updateActivity(account: string, id: string, updates: { name?: string; status?: 'active' | 'stopped'; catalogId?: string }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'status', 'catalogId']);
  // Fetch all to find row
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  // Read existing row to compute new values
  const existing = values[rowIndex - 2] || [];
  const name = updates.name ?? existing[1] ?? '';
  const status = updates.status ?? (existing[2] || 'active');
  const catalogId = updates.catalogId ?? (existing[3] || '');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!B${rowIndex}:D${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name, status, catalogId]] },
  });
  return { id, name: String(name), status: String(status), catalogId: String(catalogId || '') || undefined };
}

export async function deleteActivity(account: string, id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'status', 'catalogId']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  // Delete the row to avoid leaving empty rows that can cause duplicates or blank IDs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        }],
      },
    });
  } else {
    // Fallback: clear values if sheetId not found
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:D${rowIndex}` });
  }
  return { id };
}

// Shared activity catalog (global across accounts)
export async function listCatalog() {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Catalog`;
  await ensureSheetExists(title, ['id', 'name', 'category', 'tags']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  return values
    .filter((row) => row && row[0] && String(row[0]).trim() !== '')
    .map(([id, name, category, tags]) => ({
      id: String(id).trim(),
      name: String(name || '').trim(),
      category: String(category || '').trim(),
      tags: String(tags || '').trim(),
    }));
}

export async function createCatalogItem(name: string, category: string, tags?: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Catalog`;
  await ensureSheetExists(title, ['id', 'name', 'category', 'tags']);
  const id = String(Date.now());
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1:D`,
    valueInputOption: 'RAW',
    requestBody: { values: [[id, name, category, tags || '']] },
  });
  return { id, name, category, tags: tags || '' };
}

export async function updateCatalogItem(id: string, updates: { name?: string; category?: string; tags?: string }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Catalog`;
  await ensureSheetExists(title, ['id', 'name', 'category', 'tags']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Catalog item not found');
  const existing = values[rowIndex - 2] || [];
  const name = updates.name ?? existing[1] ?? '';
  const category = updates.category ?? existing[2] ?? '';
  const tags = updates.tags ?? existing[3] ?? '';
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!B${rowIndex}:D${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name, category, tags]] },
  });
  return { id, name: String(name), category: String(category), tags: String(tags) };
}

export async function deleteCatalogItem(id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Catalog`;
  await ensureSheetExists(title, ['id', 'name', 'category', 'tags']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Catalog item not found');
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId === 'number') {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        }],
      },
    });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:D${rowIndex}` });
  }
  return { id };
}

export async function appendLog(account: string, dateISO: string, activityId: string, completed: boolean) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Logs_${account}`;
  await ensureSheetExists(title, ['date', 'activityId', 'completed']);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1:C`,
    valueInputOption: 'RAW',
    requestBody: { values: [[dateISO, activityId, completed ? '1' : '0']] },
  });
}

export async function getLogsForDate(account: string, dateISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Logs_${account}`;
  await ensureSheetExists(title, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  const values = res.data.values || [];
  return values
    .map(([date, activityId, completed]) => ({
      date: String(date).trim(),
      activityId: String(activityId).trim(),
      completed: String(completed).trim() === '1',
    }))
    .filter((row) => row.date === dateISO);
}

export async function getLogsBetween(account: string, fromISO: string, toISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Logs_${account}`;
  await ensureSheetExists(title, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:C` });
  const values = res.data.values || [];
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return values
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

export async function setHighlight(account: string, dateISO: string, text: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Highlights_${account}`;
  await ensureSheetExists(title, ['date', 'text']);
  // Upsert: find existing row by date
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A1:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, text]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[text]] },
    });
  }
}

export async function getHighlight(account: string, dateISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Highlights_${account}`;
  await ensureSheetExists(title, ['date', 'text']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) {
      return String(values[i][1] || '');
    }
  }
  return '';
}

// Weights per account
// Sheet "Weights_<account>": columns [date ISO, weight]
export async function getWeight(account: string, dateISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Weights_${account}`;
  await ensureSheetExists(title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) {
      const w = parseFloat(String(values[i][1] || '').trim());
      return Number.isFinite(w) ? w : null;
    }
  }
  return null;
}

export async function setWeight(account: string, dateISO: string, weight: number) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Weights_${account}`;
  await ensureSheetExists(title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A1:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, String(weight)]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(weight)]] },
    });
  }
}

export async function getWeightsBetween(account: string, fromISO: string, toISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Weights_${account}`;
  await ensureSheetExists(title, ['date', 'weight']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return values
    .map(([date, weight]) => ({
      date: String(date).trim(),
      weight: parseFloat(String(weight ?? '').trim()),
    }))
    .filter(({ date, weight }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to && Number.isFinite(weight);
    });
}

// Moods per account (0..10)
// Sheet "Moods_<account>": columns [date ISO, score]
export async function getMood(account: string, dateISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Moods_${account}`;
  await ensureSheetExists(title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) {
      const s = parseInt(String(values[i][1] || '').trim(), 10);
      return Number.isFinite(s) ? s : null;
    }
  }
  return null;
}

export async function setMood(account: string, dateISO: string, score: number) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Moods_${account}`;
  await ensureSheetExists(title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A1:B`,
      valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, String(score)]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[String(score)]] },
    });
  }
}

export async function getMoodsBetween(account: string, fromISO: string, toISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Moods_${account}`;
  await ensureSheetExists(title, ['date', 'score']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return values
    .map(([date, score]) => ({
      date: String(date).trim(),
      score: parseInt(String(score ?? '').trim(), 10),
    }))
    .filter(({ date, score }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to && Number.isFinite(score);
    });
}

export async function getHighlightsBetween(account: string, fromISO: string, toISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Highlights_${account}`;
  await ensureSheetExists(title, ['date', 'text']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return values
    .map(([date, text]) => ({ date: String(date).trim(), text: String(text ?? '').trim() }))
    .filter(({ date }) => {
      const t = new Date(date).getTime();
      return !Number.isNaN(t) && t >= from && t <= to;
    });
}
export async function getConsistencyMetrics(account: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const logsTitle = `Logs_${account}`;
  const actsTitle = `Activities_${account}`;
  await ensureSheetExists(logsTitle, ['date', 'activityId', 'completed']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${logsTitle}!A2:C` });
  const values = res.data.values || [];
  // Count active activities for expected totals
  await ensureSheetExists(actsTitle, ['id', 'name']);
  const activitiesRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${actsTitle}!A2:B` });
  const activities = (activitiesRes.data.values || []).map(([id, name]) => ({ id, name }));
  const activityCount = Array.isArray(activities) ? activities.length : 0;
  const activityMap: Record<string, { id: string; name: string }> = {};
  for (const a of Array.isArray(activities) ? activities : []) {
    activityMap[a.id] = { id: a.id, name: a.name };
  }
  // Aggregate completion rate per week with counts and moving average
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
      return {
        week,
        done,
        total: expectedTotal,
        rate,
        date: start ? start.toISOString().slice(0, 10) : undefined,
      };
    })
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  // 4-week moving average of rate
  for (let i = 0; i < weeks.length; i++) {
    const start = Math.max(0, i - 3);
    const slice = weeks.slice(start, i + 1);
    const avg = slice.reduce((acc, w) => acc + w.rate, 0) / slice.length;
    (weeks[i] as any).movingAvg4 = avg;
  }

  // Summary: average rate, best week, current streak days
  const avgRate = weeks.length ? weeks.reduce((acc, w) => acc + w.rate, 0) / weeks.length : 0;
  let bestWeek: { week: string; rate: number } | null = null;
  for (const w of weeks) {
    if (!bestWeek || w.rate > bestWeek.rate) bestWeek = { week: w.week, rate: w.rate };
  }
  const currentStreakDays = computeCurrentStreakDays(completedDates);

  // Per-activity breakdown: done per week / expected days in that week
  const byActivityWeek: Record<string, Record<string, { done: number }>> = {};
  for (const [dateISO, activityId, completed] of values) {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) continue;
    const weekKey = `${d.getUTCFullYear()}-W${getWeekNumber(d)}`;
    const act = (byActivityWeek[activityId] ||= {});
    const bucket = (act[weekKey] ||= { done: 0 });
    if (completed === '1') bucket.done += 1;
  }

  // Build a Map for O(1) week lookups instead of O(n) find() per activity-week pair
  const weeksMap = new Map(weeks.map((w) => [w.week, w]));

  const byActivity = Object.entries(byActivityWeek).map(([activityId, actWeeksMap]) => {
    const label = activityMap[activityId]?.name || activityId;
    const activityWeeks = Object.entries(actWeeksMap).map(([weekKey, agg]) => {
      const overall = weeksMap.get(weekKey);
      const expectedDays = overall ? Math.max(1, Math.min(7, Math.round((overall.total || 0) / Math.max(1, activityCount)))) : 7;
      const rate = expectedDays ? agg.done / expectedDays : 0;
      return { week: weekKey, done: agg.done, total: expectedDays, rate };
    }).sort((a, b) => a.week.localeCompare(b.week));
    return { id: activityId, name: label, weeks: activityWeeks };
  });

  return {
    weeks,
    byActivity,
    summary: {
      avgRate,
      bestWeek,
      currentStreakDays,
      totalCompletions,
    },
  };
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

function getIsoWeekStart(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // 1..7 (Mon..Sun), treat Sun as 7
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

function computeExpectedDaysInWeek(start?: Date, end?: Date) {
  if (!start || !end) return 0;
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  // If week is fully in the past, expect 7 days; if current week, expect up to today; if future, expect 0
  if (end < today) return 7;
  if (start > today) return 0;
  // days from start..today inclusive
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
  return Math.min(7, Math.max(0, diff));
}

function computeCurrentStreakDays(completedDates: Set<string>) {
  let streak = 0;
  const today = new Date();
  // Use UTC date ISO format to match stored dates (YYYY-MM-DD)
  const toISO = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  while (true) {
    const iso = toISO(cursor);
    if (completedDates.has(iso)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ---------------- Climbing: Logs and Goals ----------------
// Climbs_<account>: [id, date, session, type, grade, attempts, location, notes]
// ClimbGoals_<account>: [id, year, type, grade, target]

export type ClimbLog = { id: string; date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string };
export type ClimbGoal = { id: string; year: number; type: 'boulder' | 'rope'; grade: string; target: number };

export async function listClimbLogs(account: string, fromISO?: string, toISO?: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Climbs_${account}`;
  await ensureSheetExists(title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:H` });
  const values = res.data.values || [];
  const rows: ClimbLog[] = values
    .filter((r) => r && r[0])
    .map(([id, date, session, type, grade, attempts, location, notes]) => ({
      id: String(id).trim(),
      date: String(date).trim(),
      session: parseInt(String(session ?? '0'), 10) || 0,
      type: (String(type || 'boulder').trim().toLowerCase() === 'rope' ? 'rope' : 'boulder'),
      grade: String(grade || '').trim(),
      attempts: parseInt(String(attempts ?? '0'), 10) || 0,
      location: String(location || '').trim() || undefined,
      notes: String(notes || '').trim() || undefined,
    }));
  if (!fromISO || !toISO) return rows;
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return rows.filter((r) => {
    const t = new Date(r.date).getTime();
    return !Number.isNaN(t) && t >= from && t <= to;
  });
}

export async function addClimbLog(account: string, entry: { date: string; session: number; type: 'boulder' | 'rope'; grade: string; attempts: number; location?: string; notes?: string }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Climbs_${account}`;
  await ensureSheetExists(title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
  const id = String(Date.now());
  const row = [id, entry.date, String(entry.session || 0), entry.type, entry.grade, String(entry.attempts || 0), String(entry.location || ''), String(entry.notes || '')];
  await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:H`, valueInputOption: 'RAW', requestBody: { values: [row] } });
  return { id, ...entry } as ClimbLog;
}

export async function deleteClimbLog(account: string, id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Climbs_${account}`;
  await ensureSheetExists(title, ['id', 'date', 'session', 'type', 'grade', 'attempts', 'location', 'notes']);
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

export async function listClimbGoals(account: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(title, ['id', 'year', 'type', 'grade', 'target']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:E` });
  const values = res.data.values || [];
  return values.filter((r) => r && r[0]).map(([id, year, type, grade, target]) => ({
    id: String(id).trim(),
    year: parseInt(String(year ?? '0'), 10) || new Date().getFullYear(),
    type: (String(type || 'boulder').trim().toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope',
    grade: String(grade || '').trim(),
    target: parseInt(String(target ?? '0'), 10) || 0,
  })) as ClimbGoal[];
}

export async function upsertClimbGoal(account: string, goal: { year: number; type: 'boulder' | 'rope'; grade: string; target: number }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(title, ['id', 'year', 'type', 'grade', 'target']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:E` });
  const values = res.data.values || [];
  let rowIndex = -1;
  let existingId = '';
  for (let i = 0; i < values.length; i++) {
    const [id, year, type, grade] = values[i];
    if (
      parseInt(String(year ?? '0'), 10) === goal.year &&
      String(type || '').trim().toLowerCase() === goal.type &&
      String(grade || '').trim().toLowerCase() === goal.grade.trim().toLowerCase()
    ) { rowIndex = i + 2; existingId = id; break; }
  }
  if (rowIndex === -1) {
    const id = String(Date.now());
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:E`, valueInputOption: 'RAW', requestBody: { values: [[id, String(goal.year), goal.type, goal.grade, String(goal.target)]] } });
    return { id, ...goal } as ClimbGoal;
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!E${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[String(goal.target)]] } });
    return { id: existingId, ...goal } as ClimbGoal;
  }
}

export async function deleteClimbGoal(account: string, id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `ClimbGoals_${account}`;
  await ensureSheetExists(title, ['id', 'year', 'type', 'grade', 'target']);
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

// ---------------- Time Tracking (Daily rows) ----------------
// Hours_<account>: [date, h1, h2, ..., h24] where each hN is category id (0..11) or empty
export type HourLog = { id: string; date: string; hour: number; category: number };

function hourIndexToColumnLetter(hourIndex: number) {
  // hourIndex 0..23 maps to column B..Y (A is date)
  const colNumber = 2 + hourIndex; // 1-based: A=1, B=2
  // Convert to letter(s)
  let n = colNumber;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export async function listHourLogs(account: string, fromISO?: string, toISO?: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(title, headers);
  // Read columns A (date) through Y (24 hours)
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const values = res.data.values || [];
  const expand: HourLog[] = [];
  for (const row of values) {
    if (!row || !row[0]) continue;
    const date = String(row[0]).trim();
    for (let h = 0; h < 24; h++) {
      const v = row[1 + h];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const category = parseInt(String(v).trim(), 10);
        if (Number.isFinite(category)) {
          expand.push({ id: `${date}-${h}`, date, hour: h, category });
        }
      }
    }
  }
  if (!fromISO || !toISO) return expand;
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  return expand.filter((r) => {
    const t = new Date(r.date).getTime();
    return !Number.isNaN(t) && t >= from && t <= to;
  });
}

export async function upsertHourLog(account: string, entry: { date: string; hour: number; category: number }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(title, headers);
  // Fetch all rows to find date
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    const date = String((values[i] && values[i][0]) || '').trim();
    if (date === entry.date) { rowIndex = i + 2; break; }
  }
  const colLetter = hourIndexToColumnLetter(entry.hour);
  if (rowIndex === -1) {
    // Append a new row: date + 24 blank hours, then set the specific hour
    const row = new Array(1 + 24).fill('');
    row[0] = entry.date;
    row[1 + entry.hour] = String(entry.category);
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:Y`, valueInputOption: 'RAW', requestBody: { values: [row] } });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!${colLetter}${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[String(entry.category)]] } });
  }
  return { id: `${entry.date}-${entry.hour}`, ...entry } as HourLog;
}

export async function deleteHourLog(account: string, id: string) {
  // Not supported in daily-row model by id; consider clearing by date+hour if needed.
  return { id };
}

export async function upsertHourLogsBatch(account: string, entry: { date: string; entries: Array<{ hour: number; category: number }> }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Hours_${account}`;
  const headers = ['date', ...Array.from({ length: 24 }, (_, i) => `h${i + 1}`)];
  await ensureSheetExists(title, headers);
  // Fetch all rows to find date
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:Y` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    const date = String((values[i] && values[i][0]) || '').trim();
    if (date === entry.date) { rowIndex = i + 2; break; }
  }
  // Build the row values for columns B..Y
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
    const row = [entry.date, ...rowHours];
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:Y`, valueInputOption: 'RAW', requestBody: { values: [row] } });
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!B${rowIndex}:Y${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [rowHours] } });
  }
  return { date: entry.date, count: entry.entries.length };
}

// ---------------- Time Categories (Settings) ----------------
// TimeCategories_<account>: [id, name, color, order]
export type TimeCategory = { id: string; name: string; color: string; order: number };

export async function listTimeCategories(account: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'color', 'order']);
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
      spreadsheetId,
      range: `${title}!A1:D`,
      valueInputOption: 'RAW',
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
  // If the sheet was previously seeded without 'misc' (11), append it.
  if (!rows.some((r) => r.id === '11')) {
    const misc: TimeCategory = { id: '11', name: 'misc', color: '#64748b', order: 11 };
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A1:D`, valueInputOption: 'RAW', requestBody: { values: [[misc.id, misc.name, misc.color, String(misc.order)]] } });
    rows.push(misc);
    rows.sort((a, b) => a.order - b.order);
  }
  return rows;
}

export async function upsertTimeCategory(account: string, entry: { id?: string; name: string; color: string; order?: number }) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'color', 'order']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:D` });
  const values = res.data.values || [];
  let rowIndex = -1;
  let existingId = '';
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
    return { id, name, color, order } as TimeCategory;
  } else {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!B${rowIndex}:D${rowIndex}`, valueInputOption: 'RAW', requestBody: { values: [[name, color, String(order)]] } });
    return { id, name, color, order } as TimeCategory;
  }
}

export async function deleteTimeCategory(account: string, id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `TimeCategories_${account}`;
  await ensureSheetExists(title, ['id', 'name', 'color', 'order']);
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
