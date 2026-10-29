// The "Year (old)" and "Goals (old)" share images: transparent 1080x1920 PNGs drawn on a canvas.
// Kept as "More styles" in the share sheet. Numbers are worked out only when one is made.
import { localISO as toLocalISO, parseLocalDate, weekStartLocal } from '@/lib/date';
import { vScaleToNumber, FRENCH_GRADES, frenchToIndex } from '@/lib/climbing';
import { weeklySeries as calcWeeklySeries } from '@/lib/climbStats';
import { COLORS } from '@/lib/colors';
import type { ClimbLog } from '@/lib/types';

export type OverlayGoal = { grade: string; type: string; done: number; target: number; pct: number };

function yearSummary(ylogs: ClimbLog[], year: number, today: string) {
  const total = ylogs.length;
  if (!total) {
    return { total: 0, flashRate: 0, avgAttempts: 0, days: 0, weeks: 0, weeklyAvg: 0, bestWeek: 0, bestBoulder: null as null | string, bestRope: null as null | string, series: [] as Array<{ date: string; count: number }> };
  }
  const flashes = ylogs.filter((l) => l.attempts === 0).length;
  const flashRate = Math.round((flashes / total) * 100);
  const avgAttempts = Math.round((ylogs.reduce((a, l) => a + (l.attempts || 0), 0) / total) * 10) / 10;
  const days = new Set(ylogs.map((l) => l.date.slice(0, 10))).size;
  const weekMap = new Map<string, number>();
  for (const l of ylogs) {
    const key = toLocalISO(weekStartLocal(parseLocalDate(l.date)));
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  }
  const weeks = weekMap.size;
  // Weekly average counts rest weeks as 0 (same as weeklySeries / sendsPerWeek), up to today or the year's end.
  const yJan1 = `${year}-01-01`;
  const yDec31 = `${year}-12-31`;
  const avgEnd = today < yJan1 ? yJan1 : today > yDec31 ? yDec31 : today;
  const avgSeries = calcWeeklySeries(ylogs, yJan1, avgEnd);
  const weeklyAvg = avgSeries.length ? Math.round((avgSeries.reduce((a, w) => a + w.count, 0) / avgSeries.length) * 10) / 10 : 0;
  const bestWeek = Array.from(weekMap.values()).reduce((m, c) => Math.max(m, c), 0);
  // A contiguous weekly series from the first Monday within the year to Dec 31 (zeros for missing weeks).
  const yearEnd = new Date(year, 11, 31);
  const start = weekStartLocal(new Date(year, 0, 1));
  if (start.getFullYear() < year) start.setDate(start.getDate() + 7);
  const series: Array<{ date: string; count: number }> = [];
  for (let d = new Date(start); d.getTime() <= yearEnd.getTime(); d.setDate(d.getDate() + 7)) {
    const key = toLocalISO(d);
    series.push({ date: key, count: weekMap.get(key) || 0 });
  }
  const boulderNums = ylogs.filter((l) => l.type === 'boulder').map((l) => vScaleToNumber(l.grade)).filter((n): n is number => n != null);
  const bestBoulder = boulderNums.length ? `V${Math.max(...boulderNums)}` : null;
  const ropeIdxs = ylogs.filter((l) => l.type === 'rope').map((l) => frenchToIndex(l.grade)).filter((n): n is number => n != null);
  const bestRope = ropeIdxs.length ? FRENCH_GRADES[Math.max(...ropeIdxs)] : null;
  return { total, flashRate, avgAttempts, days, weeks, weeklyAvg, bestWeek, bestBoulder, bestRope, series };
}

function createOverlayCanvas() {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, W, H);
  const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
  const accent = COLORS.accent;
  const green = COLORS.success;
  const muted = '#ffffff';
  const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 28; c.shadowOffsetX = 0; c.shadowOffsetY = 2; };
  const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
  const write = (text: string, size: number, x: number, y: number, opts: { bold?: boolean; color?: string; align?: CanvasTextAlign } = {}) => {
    c.font = `${opts.bold ? '700' : '400'} ${size}px ${font}`;
    c.fillStyle = opts.color || '#ffffff';
    c.textAlign = opts.align || 'center';
    shadow(); c.fillText(text, x, y); c.fillText(text, x, y); noShadow();
  };
  const download = (name: string) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };
  return { c, W, H, write, accent, green, muted, shadow, noShadow, download };
}

function drawProgressRing(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, pct: number, accent: string, green: string) {
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 16; c.stroke();
  const start = -Math.PI / 2;
  c.beginPath(); c.arc(cx, cy, r, start, start + Math.PI * 2 * Math.min(1, pct / 100));
  c.strokeStyle = pct >= 100 ? green : accent;
  c.lineWidth = 16; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
}

/** Downloads the year summary image for `year` (bottom half; the top is left for a photo). */
export function downloadYearOverlay(ylogs: ClimbLog[], year: number, today: string) {
  const s = yearSummary(ylogs, year, today);
  const { c, W, H, write, accent, muted, shadow, noShadow, download } = createOverlayCanvas();
  if (!c) return;
  const cx = W / 2;
  const baseY = H * 0.42;

  write(`${year}`, 48, cx, baseY, { color: muted });
  write('CLIMBING YEAR', 72, cx, baseY + 70, { bold: true });
  write(String(s.total), 160, cx, baseY + 230, { bold: true, color: accent });
  write('TOTAL SENDS', 32, cx, baseY + 270, { color: muted });

  // Stats grid (2 cols x 4 rows)
  const stats = [
    { label: 'FLASH RATE', value: `${s.flashRate}%` },
    { label: 'AVG ATTEMPTS', value: `${s.avgAttempts}` },
    { label: 'DAYS CLIMBED', value: `${s.days}` },
    { label: 'ACTIVE WEEKS', value: `${s.weeks}` },
    { label: 'WEEKLY AVG', value: `${s.weeklyAvg}` },
    { label: 'BEST WEEK', value: `${s.bestWeek}` },
    { label: 'BEST BOULDER', value: s.bestBoulder || '—' },
    { label: 'BEST ROPE', value: s.bestRope || '—' },
  ];
  const gridY = baseY + 340;
  const colW = W / 2;
  const rowH = 100;
  stats.forEach((st, i) => {
    const sx = colW * (i % 2) + colW / 2;
    const sy = gridY + Math.floor(i / 2) * rowH;
    write(st.value, 52, sx, sy, { bold: true });
    write(st.label, 22, sx, sy + 34, { color: muted });
  });

  // Sparkline at the bottom
  if (s.series.length > 1) {
    const series = s.series;
    const padX = 96;
    const chartX = padX; const chartW = W - padX * 2;
    const chartY = gridY + rowH * 4 + 40; const chartH = 180;
    const max = Math.max(...series.map((p) => p.count), 1);
    const n = series.length;
    const stepX = chartW / (n - 1);
    const trace = () => {
      for (let i = 0; i < n; i++) {
        const px = chartX + stepX * i;
        const py = chartY + chartH - (series[i].count / max) * chartH;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
    };
    c.beginPath(); trace();
    c.lineTo(chartX + chartW, chartY + chartH);
    c.lineTo(chartX, chartY + chartH);
    c.closePath();
    c.fillStyle = `${accent}30`;
    c.fill();
    c.beginPath(); trace();
    c.strokeStyle = accent; c.lineWidth = 4; shadow(); c.stroke(); noShadow();
    write('WEEKLY ACTIVITY', 24, cx, chartY - 12, { color: muted });
  }

  download(`climbing-year-${year}.png`);
}

/** Downloads the goals image for `year`: up to 6 goal rings. */
export function downloadGoalsOverlay(allGoals: OverlayGoal[], year: number) {
  const { c, W, H, write, accent, green, muted, download } = createOverlayCanvas();
  if (!c) return;
  const cx = W / 2;
  const goals = allGoals.slice(0, 6);
  const baseY = H * 0.38;
  write(`${year}`, 48, cx, baseY, { color: muted });
  write('CLIMBING GOALS', 72, cx, baseY + 70, { bold: true });

  const succeeded = goals.filter((g) => g.done >= g.target).length;
  write(`${succeeded}/${goals.length} completed`, 36, cx, baseY + 120, { color: succeeded === goals.length ? green : accent });

  if (!goals.length) {
    write('No goals set', 48, cx, baseY + 200, { color: muted });
    download(`goals-${year}.png`);
    return;
  }

  const ringY = baseY + 280;
  const maxPerRow = Math.min(goals.length, 3);
  const rows = Math.ceil(goals.length / maxPerRow);
  const ringR = goals.length <= 3 ? 90 : 70;
  const ringSpacing = W / (maxPerRow + 1);
  const rowSpacing = ringR * 2 + 120;

  goals.forEach((g, i) => {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const colsInRow = row < rows - 1 ? maxPerRow : goals.length - row * maxPerRow;
    const rowOffset = (W - ringSpacing * (colsInRow - 1)) / 2;
    const gx = colsInRow === 1 ? cx : rowOffset + col * ringSpacing;
    const gy = ringY + row * rowSpacing;
    drawProgressRing(c, gx, gy, ringR, g.pct, accent, green);
    write(`${g.pct}%`, ringR > 80 ? 48 : 36, gx, gy + (ringR > 80 ? 8 : 6), { bold: true, color: g.pct >= 100 ? green : accent });
    write(`${g.done}/${g.target}`, ringR > 80 ? 24 : 20, gx, gy + (ringR > 80 ? 40 : 30), { color: muted });
    write(g.grade.toUpperCase(), 36, gx, gy + ringR + 40, { bold: true });
    write(g.type.toUpperCase(), 20, gx, gy + ringR + 68, { color: muted });
  });

  download(`goals-${year}.png`);
}
