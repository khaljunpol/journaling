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

// Data model:
// - Sheet "Activities": columns [id, name]
// - Sheet "Logs": columns [date ISO, activityId, completed]
// - Sheet "Highlights": columns [date ISO, text]

export async function listActivities() {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Activities!A2:B',
  });
  const values = res.data.values || [];
  return values.map(([id, name]) => ({ id, name }));
}

export async function createActivity(name: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const id = String(Date.now());
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Activities!A:B',
    valueInputOption: 'RAW',
    requestBody: { values: [[id, name]] },
  });
  return { id, name };
}

export async function updateActivity(id: string, name: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  // Fetch all to find row
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Activities!A2:B' });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Activities!B${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name]] },
  });
  return { id, name };
}

export async function deleteActivity(id: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Activities!A2:B' });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error('Activity not found');
  // Clear the row
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `Activities!A${rowIndex}:B${rowIndex}` });
  return { id };
}

export async function appendLog(dateISO: string, activityId: string, completed: boolean) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Logs!A:C',
    valueInputOption: 'RAW',
    requestBody: { values: [[dateISO, activityId, completed ? '1' : '0']] },
  });
}

export async function getLogsForDate(dateISO: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Logs!A2:C' });
  const values = res.data.values || [];
  return values
    .filter((row) => row[0] === dateISO)
    .map(([date, activityId, completed]) => ({ date, activityId, completed: completed === '1' }));
}

export async function setHighlight(dateISO: string, text: string) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  // Upsert: find existing row by date
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Highlights!A2:B' });
  const values = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === dateISO) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Highlights!A:B',
      valueInputOption: 'RAW',
      requestBody: { values: [[dateISO, text]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Highlights!B${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[text]] },
    });
  }
}

export async function getConsistencyMetrics() {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Logs!A2:C' });
  const values = res.data.values || [];
  // Aggregate completion rate per week
  const byWeek: Record<string, { done: number; total: number }> = {};
  for (const [dateISO, _activityId, completed] of values) {
    const d = new Date(dateISO);
    const weekKey = `${d.getUTCFullYear()}-W${getWeekNumber(d)}`;
    if (!byWeek[weekKey]) byWeek[weekKey] = { done: 0, total: 0 };
    byWeek[weekKey].total += 1;
    if (completed === '1') byWeek[weekKey].done += 1;
  }
  return Object.entries(byWeek)
    .map(([week, { done, total }]) => ({ week, rate: total ? done / total : 0 }));
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
