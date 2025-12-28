import { listActivities, getLogsBetween, getLogsForDate, getConsistencyMetrics } from '@/lib/googleSheets';

export default async function Page() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const fromISO = `${y}-${pad(m)}-01`;
  const toISO = `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayISO = today.toISOString().slice(0, 10);
  const d7 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d7.setUTCDate(d7.getUTCDate() - 6);
  const from7ISO = d7.toISOString().slice(0, 10);
  const d30 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d30.setUTCDate(d30.getUTCDate() - 29);
  const from30ISO = d30.toISOString().slice(0, 10);

  let activityCount = 0;
  let monthRate = 0;
  let doneToday = 0;
  let streakDays = 0;
  let avgWeeklyRate = 0;
  let bestWeekLabel: string | undefined;
  let bestWeekRate = 0;
  let last7Done = 0;
  let last7Expected = 0;
  let last30Done = 0;
  let thisWeekRate = 0;
  let lastWeekRate = 0;
  let topActivities30: Array<{ name: string; count: number }> = [];
  const account = 'Alex';
  try {
    const acts = await listActivities(account);
    activityCount = acts.length;
    // Today status
    try {
      const logs = await getLogsForDate(account, todayISO);
      doneToday = logs.filter((l) => l.completed).length;
    } catch {}
    // Last 7 / 30 days
    try {
      const logs7 = await getLogsBetween(account, from7ISO, todayISO);
      last7Done = logs7.filter((l) => l.completed).length;
      last7Expected = activityCount * 7;
      const logs30 = await getLogsBetween(account, from30ISO, todayISO);
      last30Done = logs30.filter((l) => l.completed).length;
      // Top activities in 30 days
      const byAct: Record<string, number> = {};
      for (const l of logs30) if (l.completed) byAct[l.activityId] = (byAct[l.activityId] || 0) + 1;
      const nameMap: Record<string, string> = Object.fromEntries(acts.map((a) => [a.id, a.name]));
      topActivities30 = Object.entries(byAct)
        .map(([id, count]) => ({ name: nameMap[id] || id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    } catch {}
  } catch {}
  try {
    const logs = await getLogsBetween(account, fromISO, toISO);
    const total = logs.length;
    const done = logs.filter((l) => l.completed).length;
    monthRate = total ? done / total : 0;
  } catch {}
  try {
    const metrics = await getConsistencyMetrics(account);
    avgWeeklyRate = metrics?.summary?.avgRate || 0;
    streakDays = metrics?.summary?.currentStreakDays || 0;
    bestWeekLabel = metrics?.summary?.bestWeek?.week;
    bestWeekRate = metrics?.summary?.bestWeek?.rate || 0;
    if (Array.isArray(metrics?.weeks) && metrics.weeks.length) {
      const n = metrics.weeks.length;
      thisWeekRate = metrics.weeks[n - 1]?.rate || 0;
      lastWeekRate = metrics.weeks[n - 2]?.rate || 0;
    }
  } catch {}

  return (
    <main className="space-y-8">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Activities</div>
          <div className="text-2xl font-semibold">{activityCount}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Today</div>
          <div className="text-2xl font-semibold">{doneToday}/{activityCount} done</div>
          <div className="text-xs text-neutral-500">Streak: {streakDays} days</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Shortcuts</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a className="underline underline-offset-2" href="/journal">Open Journal</a></li>
            <li><a className="underline underline-offset-2" href="/activities">Manage Activities</a></li>
            <li><a className="underline underline-offset-2" href="/metrics">View Metrics</a></li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Last 7 Days</div>
          <div className="text-2xl font-semibold">{last7Expected ? Math.round((last7Done / last7Expected) * 100) : 0}%</div>
          <div className="text-xs text-neutral-500">{last7Done}/{last7Expected} completions</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Avg Weekly Rate</div>
          <div className="text-2xl font-semibold">{Math.round(avgWeeklyRate * 100)}%</div>
          <div className="text-xs text-neutral-500">Best: {bestWeekLabel ? `${Math.round(bestWeekRate * 100)}% (${bestWeekLabel})` : '-'}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">This vs Last Week</div>
          <div className="text-2xl font-semibold">{Math.round(thisWeekRate * 100)}% / {Math.round(lastWeekRate * 100)}%</div>
          <div className="text-xs text-neutral-500">current / previous</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-neutral-500">Last 30 Days</div>
          <div className="text-2xl font-semibold">{last30Done}</div>
          <div className="text-xs text-neutral-500">total completions</div>
        </div>
        <div className="rounded border p-4 sm:col-span-2">
          <div className="text-sm text-neutral-500">Top Activities (30d)</div>
          <ul className="mt-2 space-y-1 text-sm">
            {topActivities30.length ? topActivities30.map((t) => (
              <li key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span className="text-neutral-500">{t.count}</span>
              </li>
            )) : <li className="text-neutral-500">No recent completions</li>}
          </ul>
        </div>
      </div>
    </main>
  );
}
