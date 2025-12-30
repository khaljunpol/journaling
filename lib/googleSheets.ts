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

async function ensureSheetExists(title: string, headers?: string[]) {
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
  }
  if (headers && headers.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

// Data model (separate tabs per account):
// - Sheet "Activities_<account>": columns [id, name]
// - Sheet "Logs_<account>": columns [date ISO, activityId, completed]
// - Sheet "Highlights_<account>": columns [date ISO, text]

export async function listActivities(account: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name']);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A2:B`,
  });
  const values = res.data.values || [];
  return values
    .filter((row) => row && row[0] && String(row[0]).trim() !== '')
    .map(([id, name]) => ({ id: String(id).trim(), name: String(name || '').trim() }));
}

export async function createActivity(account: string, name: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name']);
  const id = String(Date.now());
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A1:B`,
    valueInputOption: 'RAW',
    requestBody: { values: [[id, name]] },
  });
  return { id, name };
}

export async function updateActivity(account: string, id: string, name: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name']);
  // Fetch all to find row
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!B${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name]] },
  });
  return { id, name };
}

export async function deleteActivity(account: string, id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const title = `Activities_${account}`;
  await ensureSheetExists(title, ['id', 'name']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A2:B` });
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
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${title}!A${rowIndex}:B${rowIndex}` });
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

  const byActivity = Object.entries(byActivityWeek).map(([activityId, weeksMap]) => {
    const label = activityMap[activityId]?.name || activityId;
    const activityWeeks = Object.entries(weeksMap).map(([weekKey, agg]) => {
      // Find corresponding overall week start to compute expectedDays
      const overall = weeks.find((w) => w.week === weekKey);
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
