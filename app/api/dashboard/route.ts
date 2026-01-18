import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get('account') || 'Alex';
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = new Date();
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayISO = toISO(today);
    const d7 = new Date(today); d7.setDate(d7.getDate() - 6);
    const from7ISO = toISO(d7);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 29);
    const from30ISO = toISO(d30);
    const weekStart = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = x.getDay(); const diff = (day === 0 ? -6 : 1 - day); x.setDate(x.getDate() + diff); return x; };
    const ws = weekStart(today);
    const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    const prevWs = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7);
    const prevWe = new Date(prevWs.getFullYear(), prevWs.getMonth(), prevWs.getDate() + 6);
    const weekFromISO = toISO(ws);
    const weekToISO = toISO(we);
    const prevWeekFromISO = toISO(prevWs);
    const prevWeekToISO = toISO(prevWe);
    const y = today.getFullYear();
    const yStartISO = `${y}-01-01`;
    const yEndISO = `${y}-12-31`;
    const eightWeeksAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 8);
    const eightWeeksAgoISO = toISO(eightWeeksAgo);
    const twelveWeeksAgo = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * 12);
    const twelveWeeksAgoISO = toISO(twelveWeeksAgo);

    const fetchJson = async (path: string) => {
      const u = new URL(path, url.origin).toString();
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    };

    // Sequential to avoid Sheets burst limits
    const activities = await fetchJson(`/api/activities?account=${encodeURIComponent(account)}`);
    const catalog = await fetchJson(`/api/catalog`);
    const logs30 = await fetchJson(`/api/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
    const weights8w = await fetchJson(`/api/weights?from=${eightWeeksAgoISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
    const highlights30 = await fetchJson(`/api/highlights?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
    const moods7 = await fetchJson(`/api/moods?from=${from7ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
    const moodsPrev7 = await fetchJson(`/api/moods?from=${prevWeekFromISO}&to=${prevWeekToISO}&account=${encodeURIComponent(account)}`);
    const metrics = await fetchJson(`/api/metrics?account=${encodeURIComponent(account)}`);
    const timeCategories = await fetchJson(`/api/time/categories?account=${encodeURIComponent(account)}`);
    const timeY = await fetchJson(`/api/time?from=${yStartISO}&to=${yEndISO}&account=${encodeURIComponent(account)}`);
    const climb30 = await fetchJson(`/api/climbing/logs?from=${from30ISO}&to=${todayISO}&account=${encodeURIComponent(account)}`);
    const goals = await fetchJson(`/api/climbing/goals?account=${encodeURIComponent(account)}`);
    const climbY = await fetchJson(`/api/climbing/logs?from=${yStartISO}&to=${yEndISO}&account=${encodeURIComponent(account)}`);

    return NextResponse.json({
      account,
      dates: { todayISO, from7ISO, from30ISO, weekFromISO, weekToISO, prevWeekFromISO, prevWeekToISO, yStartISO, yEndISO, eightWeeksAgoISO, twelveWeeksAgoISO },
      activities: Array.isArray(activities) ? activities : [],
      catalog: Array.isArray(catalog) ? catalog : [],
      logs30: Array.isArray(logs30) ? logs30 : [],
      weights8w: Array.isArray(weights8w) ? weights8w : [],
      highlights30: Array.isArray(highlights30) ? highlights30 : [],
      moods7: Array.isArray(moods7) ? moods7 : [],
      metrics: metrics || null,
      timeCategories: Array.isArray(timeCategories) ? timeCategories : [],
      timeY: Array.isArray(timeY) ? timeY : [],
      climb30: Array.isArray(climb30) ? climb30 : [],
      goals: Array.isArray(goals) ? goals : [],
      climbY: Array.isArray(climbY) ? climbY : [],
      moodsPrev7: Array.isArray(moodsPrev7) ? moodsPrev7 : [],
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to aggregate dashboard data' }, { status: 500 });
  }
}
