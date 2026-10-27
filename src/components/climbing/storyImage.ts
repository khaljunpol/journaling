// Draws the climbing images on a canvas: the story and the all-goals story (1080 x 1920),
// and a small see-through overlay card for on top of a video or photo. Data comes from src/lib/climbStory.ts.
import type { StoryData, YearStoryData } from '@/lib/climbStory';

export const STORY_W = 1080;
export const STORY_H = 1920;

// Vantage colours. Ember only when the goal is complete; green only for flash.
const BG = '#0B0D14';
const SURFACE = '#141826';
const LINE = 'rgba(255,255,255,0.07)';
const TEXT1 = '#F3F5F9';
const TEXT2 = '#A4AEC4';
const TEXT3 = '#8590AC';
const VIOLET = '#9B8CFF';
const VIOLET_FILL = '#6A5AE0';
const EMBER = '#F0A24A';
const OK = '#34D399';

// Instagram covers the top ~220 px and bottom ~340 px with its own UI.
const SAFE_TOP = 220;
const SAFE_BOTTOM = STORY_H - 340;
const PAD = 80;

function fontFamily(cssVar: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** Wait until Geist and Geist Mono are ready, so the canvas does not fall back to a system font. */
async function loadFonts(sans: string, mono: string) {
  try {
    await Promise.all([
      document.fonts.load(`500 40px ${sans}`),
      document.fonts.load(`700 40px ${sans}`),
      document.fonts.load(`500 40px ${mono}`),
      document.fonts.load(`700 40px ${mono}`),
    ]);
    await document.fonts.ready;
  } catch { /* draw with the fallback font */ }
}

type TextOpts = { size: number; weight?: number; color?: string; align?: CanvasTextAlign; mono?: boolean; spacing?: number };
type Spaced = CanvasRenderingContext2D & { letterSpacing: string };

/** A canvas with the fonts loaded and small text and panel helpers. */
async function setup(w: number, h: number) {
  const sans = fontFamily('--font-geist-sans', 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
  const mono = fontFamily('--font-geist-mono', 'ui-monospace, Menlo, monospace');
  await loadFonts(sans, mono);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas is not available');

  const text = (s: string, x: number, y: number, o: TextOpts) => {
    c.font = `${o.weight ?? 500} ${o.size}px ${o.mono ? mono : sans}`;
    c.fillStyle = o.color ?? TEXT1;
    c.textAlign = o.align ?? 'left';
    c.textBaseline = 'alphabetic';
    (c as Spaced).letterSpacing = o.spacing ? `${o.spacing}px` : '0px';
    c.fillText(s, x, y);
    (c as Spaced).letterSpacing = '0px';
  };
  const measure = (s: string, o: TextOpts) => {
    c.font = `${o.weight ?? 500} ${o.size}px ${o.mono ? mono : sans}`;
    return c.measureText(s).width + (o.spacing ?? 0) * s.length; // canvas measureText ignores our letter spacing
  };
  const panel = (x: number, y: number, pw: number, ph: number, fill = SURFACE, radius = 32) => {
    c.beginPath();
    c.roundRect(x, y, pw, ph, radius);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = LINE;
    c.stroke();
  };
  /** Progress ring: violet gradient, ember when complete. */
  const ring = (cx: number, cy: number, r: number, width: number, pct: number, complete: boolean) => {
    c.lineCap = 'round';
    c.lineWidth = width;
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    if (pct <= 0) return;
    const start = -Math.PI / 2;
    if (complete) {
      c.strokeStyle = EMBER;
    } else {
      const grad = c.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
      grad.addColorStop(0, VIOLET_FILL);
      grad.addColorStop(1, VIOLET);
      c.strokeStyle = grad;
    }
    c.beginPath();
    c.arc(cx, cy, r, start, start + Math.PI * 2 * Math.min(1, pct / 100));
    c.stroke();
  };
  return { canvas, c, text, measure, panel, ring };
}

/** Deep navy with a soft violet glow at the top. */
function paintBackground(c: CanvasRenderingContext2D) {
  c.fillStyle = BG;
  c.fillRect(0, 0, STORY_W, STORY_H);
  const glow = c.createRadialGradient(STORY_W / 2, -80, 40, STORY_W / 2, -80, 1100);
  glow.addColorStop(0, 'rgba(106,90,224,0.42)');
  glow.addColorStop(0.55, 'rgba(106,90,224,0.10)');
  glow.addColorStop(1, 'rgba(106,90,224,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, STORY_W, STORY_H);
}

/** App mark (violet tile with a small peak) with its baseline-aligned bottom at y. */
function paintMark(c: CanvasRenderingContext2D, x: number, y: number, size = 52) {
  const k = size / 52;
  c.beginPath();
  c.roundRect(x, y - 40 * k, size, size, 14 * k);
  c.fillStyle = VIOLET_FILL;
  c.fill();
  c.beginPath();
  c.moveTo(x + 11 * k, y - 6 * k);
  c.lineTo(x + 26 * k, y - 28 * k);
  c.lineTo(x + 41 * k, y - 6 * k);
  c.strokeStyle = '#fff';
  c.lineWidth = 5 * k;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}

export async function renderStory(data: StoryData): Promise<HTMLCanvasElement> {
  const { canvas, c, text, measure, panel, ring } = await setup(STORY_W, STORY_H);

  const g = data.goal;
  const accent = g.complete ? EMBER : VIOLET;

  paintBackground(c);

  // ── 1. Header ──
  const headerY = SAFE_TOP + 50;
  paintMark(c, PAD, headerY);
  text('Climbing', PAD + 74, headerY, { size: 40, weight: 700 });
  text(data.dateLabel, STORY_W - PAD, headerY, { size: 36, weight: 500, color: TEXT2, align: 'right', mono: true });

  // ── 2. Goal hero ──
  const heroTop = headerY + 76;
  const badge = `${g.grade} · ${g.typeLabel.toUpperCase()}`;
  const badgeOpts: TextOpts = { size: 30, weight: 700, spacing: 2 };
  const bw = measure(badge, badgeOpts) + 56;
  c.beginPath();
  c.roundRect(PAD, heroTop, bw, 64, 32);
  c.fillStyle = g.complete ? 'rgba(240,162,74,0.16)' : 'rgba(155,140,255,0.16)';
  c.fill();
  text(badge, PAD + 28, heroTop + 43, { ...badgeOpts, color: accent });

  // Big done / target (shrinks if the numbers are long)
  const ringR = 130;
  const ringCx = STORY_W - PAD - ringR - 16;
  const maxNumW = ringCx - ringR - 40 - PAD;
  let numSize = 180;
  const targetStr = `/${g.target}`;
  const widthAt = (s: number) => measure(String(g.done), { size: s, weight: 500, mono: true }) + measure(targetStr, { size: s * 0.36, weight: 500, mono: true });
  while (numSize > 90 && widthAt(numSize) > maxNumW) numSize -= 8;
  const numY = heroTop + 64 + 32 + numSize * 0.74;
  text(String(g.done), PAD, numY, { size: numSize, weight: 500, mono: true, color: TEXT1 });
  const doneW = measure(String(g.done), { size: numSize, weight: 500, mono: true });
  text(targetStr, PAD + doneW + 6, numY, { size: numSize * 0.36, weight: 500, mono: true, color: TEXT2 });

  const paceY = numY + 66;
  text(g.pace, PAD, paceY, { size: 42, weight: 600, color: g.complete ? EMBER : TEXT2 });

  // Ring
  const ringCy = heroTop + (paceY - heroTop) / 2 + 6;
  ring(ringCx, ringCy, ringR, 30, g.pct, g.complete);
  text(`${g.pct}%`, ringCx, ringCy + 18, { size: 76, weight: 700, mono: true, color: accent, align: 'center' });
  text(g.complete ? 'DONE' : `OF ${data.year}`, ringCx, ringCy + 64, { size: 24, weight: 600, color: TEXT3, align: 'center', spacing: 3 });

  // ── 3. Today's session ──
  const sessTop = paceY + 68;
  const sessH = 190;
  const innerW = STORY_W - PAD * 2;
  panel(PAD, sessTop, innerW, sessH);
  if (data.session.rest) {
    text('Rest day', PAD + 44, sessTop + 92, { size: 64, weight: 700 });
    text('Recovery counts too.', PAD + 44, sessTop + 146, { size: 34, color: TEXT2 });
  } else {
    const s = data.session;
    const cols = [
      { v: String(s.sends), l: 'SENDS', color: TEXT1 },
      { v: String(s.flashes), l: 'FLASHES', color: s.flashes > 0 ? OK : TEXT1 },
      { v: s.hardest, l: 'HARDEST', color: TEXT1 },
      { v: String(s.attempts), l: 'ATTEMPTS', color: TEXT1 },
    ];
    const colW = (innerW - 32) / cols.length;
    cols.forEach((col, i) => {
      const x = PAD + 16 + colW * i + colW / 2;
      let size = 76;
      while (size > 34 && measure(col.v, { size, weight: 500, mono: true }) > colW - 24) size -= 4;
      text(col.v, x, sessTop + 112, { size, weight: 500, mono: true, color: col.color, align: 'center' });
      text(col.l, x, sessTop + 156, { size: 24, weight: 600, color: TEXT3, align: 'center', spacing: 3 });
      if (i > 0) {
        c.fillStyle = LINE;
        c.fillRect(PAD + 16 + colW * i - 1, sessTop + 40, 2, sessH - 80);
      }
    });
  }

  // ── 4. Charts ──
  const chartA = { x: PAD, y: sessTop + sessH + 40, w: innerW, h: 300 };
  const chartB = { x: PAD, y: chartA.y + chartA.h + 32, w: (innerW - 32) / 2, h: 260 };
  const chartC = { x: PAD + chartB.w + 32, y: chartB.y, w: chartB.w, h: chartB.h };
  const label = (s: string, x: number, y: number) => text(s, x, y, { size: 26, weight: 600, color: TEXT2 });

  // A: goal line (actual vs on pace)
  panel(chartA.x, chartA.y, chartA.w, chartA.h);
  label('Goal line', chartA.x + 36, chartA.y + 56);
  {
    const lx = chartA.x + chartA.w - 36;
    text('on pace', lx, chartA.y + 56, { size: 24, color: TEXT3, align: 'right' });
    const tw = measure('on pace', { size: 24 });
    c.setLineDash([10, 8]);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(lx - tw - 70, chartA.y + 48);
    c.lineTo(lx - tw - 16, chartA.y + 48);
    c.stroke();
    c.setLineDash([]);
    text('actual', lx - tw - 100, chartA.y + 56, { size: 24, color: TEXT3, align: 'right' });
    c.strokeStyle = accent;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(lx - tw - 100 - measure('actual', { size: 24 }) - 62, chartA.y + 48);
    c.lineTo(lx - tw - 100 - measure('actual', { size: 24 }) - 14, chartA.y + 48);
    c.stroke();
  }
  {
    const px = chartA.x + 40, pw = chartA.w - 80;
    const py = chartA.y + 96, ph = chartA.h - 96 - 56;
    const { actual, ideal, max } = data.line;
    const n = ideal.length;
    const X = (i: number) => px + (pw * i) / Math.max(1, n - 1);
    const Y = (v: number) => py + ph - (ph * v) / max;
    // baseline
    c.fillStyle = LINE;
    c.fillRect(px, py + ph, pw, 2);
    // on-pace dashed
    c.setLineDash([14, 12]);
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 4;
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(X(0), Y(ideal[0]));
    c.lineTo(X(n - 1), Y(ideal[n - 1]));
    c.stroke();
    c.setLineDash([]);
    // actual, area then line
    let last = -1;
    for (let i = 0; i < n; i++) if (actual[i] != null) last = i;
    if (last >= 0) {
      const area = c.createLinearGradient(0, py, 0, py + ph);
      area.addColorStop(0, g.complete ? 'rgba(240,162,74,0.34)' : 'rgba(155,140,255,0.34)');
      area.addColorStop(1, 'rgba(155,140,255,0)');
      c.beginPath();
      c.moveTo(X(0), py + ph);
      for (let i = 0; i <= last; i++) c.lineTo(X(i), Y(actual[i] as number));
      c.lineTo(X(last), py + ph);
      c.closePath();
      c.fillStyle = area;
      c.fill();
      c.beginPath();
      for (let i = 0; i <= last; i++) { const yy = Y(actual[i] as number); if (i === 0) c.moveTo(X(i), yy); else c.lineTo(X(i), yy); }
      c.strokeStyle = accent;
      c.lineWidth = 7;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
      c.beginPath();
      c.arc(X(last), Y(actual[last] as number), 13, 0, Math.PI * 2);
      c.fillStyle = BG;
      c.fill();
      c.lineWidth = 7;
      c.stroke();
    }
    text('Jan', px, py + ph + 40, { size: 22, color: TEXT3 });
    text('Dec', px + pw, py + ph + 40, { size: 22, color: TEXT3, align: 'right' });
  }

  // B: weekly sends, current week highlighted
  panel(chartB.x, chartB.y, chartB.w, chartB.h);
  label(`Weekly sends · ${data.year}`, chartB.x + 36, chartB.y + 56);
  {
    const px = chartB.x + 36, pw = chartB.w - 72;
    const py = chartB.y + 112, ph = chartB.h - 112 - 40;
    const weeks = data.weekly.weeks;
    const max = Math.max(1, ...weeks.map((w) => w.count));
    const slot = pw / Math.max(1, weeks.length);
    const bw2 = Math.max(3, Math.min(14, slot * 0.68));
    weeks.forEach((w, i) => {
      const x = px + slot * i + (slot - bw2) / 2;
      const isNow = i === data.weekly.currentIndex;
      const h = w.count > 0 ? Math.max(8, (ph * w.count) / max) : 4;
      c.beginPath();
      c.roundRect(x, py + ph - h, bw2, h, Math.min(4, bw2 / 2));
      c.fillStyle = isNow ? VIOLET : w.count > 0 ? 'rgba(155,140,255,0.38)' : 'rgba(255,255,255,0.08)';
      c.fill();
    });
    const now = weeks[data.weekly.currentIndex];
    if (now) {
      const x = Math.min(px + pw - 20, px + slot * data.weekly.currentIndex + slot / 2);
      text(String(now.count), x, py + ph - Math.max(8, (ph * now.count) / max) - 14, { size: 30, weight: 700, mono: true, color: VIOLET, align: 'center' });
    }
    text('session week', px + pw, chartB.y + chartB.h - 18, { size: 22, color: TEXT3, align: 'right' });
    text('Jan', px, chartB.y + chartB.h - 18, { size: 22, color: TEXT3 });
  }

  // C: attempts distribution (flash in green)
  panel(chartC.x, chartC.y, chartC.w, chartC.h);
  label(`Attempts · ${g.grade}`, chartC.x + 36, chartC.y + 56);
  {
    const px = chartC.x + 36, pw = chartC.w - 72;
    const py = chartC.y + 112, ph = chartC.h - 112 - 52;
    const b = data.attempts;
    const max = Math.max(1, ...b.map((x) => x.count));
    const slot = pw / b.length;
    const bw3 = Math.min(52, slot * 0.62);
    b.forEach((bk, i) => {
      const cx = px + slot * i + slot / 2;
      const h = bk.count > 0 ? Math.max(10, (ph * bk.count) / max) : 4;
      c.beginPath();
      c.roundRect(cx - bw3 / 2, py + ph - h, bw3, h, 8);
      const flash = bk.bucket === '0';
      c.fillStyle = bk.count === 0 ? 'rgba(255,255,255,0.08)' : flash ? OK : VIOLET;
      c.fill();
      if (bk.count > 0) text(String(bk.count), cx, py + ph - h - 12, { size: 28, weight: 700, mono: true, color: flash ? OK : TEXT1, align: 'center' });
      text(bk.label, cx, chartC.y + chartC.h - 20, { size: flash ? 22 : 26, weight: 500, color: flash && bk.count > 0 ? OK : TEXT3, align: 'center' });
    });
  }

  // ── 5. Footer (stays above the bottom safe zone) ──
  const footY = Math.min(SAFE_BOTTOM - 8, chartB.y + chartB.h + 40);
  text(`${data.year} · climbing log`, STORY_W / 2, footY, { size: 26, weight: 500, color: TEXT3, align: 'center', spacing: 2 });

  return canvas;
}

export const OVERLAY_W = 1000;
export const OVERLAY_H = 450;

/** The overlay card: goal ring, done/target and the day's stats. Transparent outside the card, so it can sit on a video. */
export async function renderOverlay(data: StoryData): Promise<HTMLCanvasElement> {
  const { canvas, c, text, measure, panel, ring } = await setup(OVERLAY_W, OVERLAY_H);
  const g = data.goal;
  const accent = g.complete ? EMBER : VIOLET;
  const P = 44;

  // Dark glass, solid enough to read on a bright wall or chalk.
  panel(2, 2, OVERLAY_W - 4, OVERLAY_H - 4, 'rgba(11,13,20,0.80)', 44);

  // Ring with the percentage
  const r = 78;
  const cx = P + r + 4, cy = 160;
  ring(cx, cy, r, 20, g.pct, g.complete);
  text(`${g.pct}%`, cx, cy + 14, { size: 44, weight: 700, mono: true, color: accent, align: 'center' });

  // Goal and pace
  const tx = cx + r + 44;
  text(`${g.grade} · ${g.typeLabel.toUpperCase()}`, tx, 104, { size: 28, weight: 700, spacing: 2, color: accent });
  const targetStr = `/${g.target}`;
  const maxW = OVERLAY_W - P - tx;
  let size = 104;
  while (size > 60 && measure(String(g.done), { size, mono: true }) + measure(targetStr, { size: size * 0.4, mono: true }) > maxW) size -= 6;
  text(String(g.done), tx, 196, { size, mono: true });
  text(targetStr, tx + measure(String(g.done), { size, mono: true }) + 4, 196, { size: size * 0.4, mono: true, color: TEXT2 });
  text(g.pace, tx, 246, { size: 32, weight: 600, color: g.complete ? EMBER : TEXT2 });

  // Date, top right
  text(data.dateLabel, OVERLAY_W - P, 104, { size: 28, mono: true, color: TEXT2, align: 'right' });

  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(P, 292, OVERLAY_W - P * 2, 2);

  if (data.session.rest) {
    text('Rest day', P, 380, { size: 52, weight: 700 });
    text('Recovery counts too.', OVERLAY_W - P, 380, { size: 30, color: TEXT2, align: 'right' });
  } else {
    const s = data.session;
    const cols = [
      { v: String(s.sends), l: 'SENDS', color: TEXT1 },
      { v: String(s.flashes), l: 'FLASHES', color: s.flashes > 0 ? OK : TEXT1 },
      { v: s.hardest, l: 'HARDEST', color: TEXT1 },
      { v: String(s.attempts), l: 'ATTEMPTS', color: TEXT1 },
    ];
    const colW = (OVERLAY_W - P * 2) / cols.length;
    cols.forEach((col, i) => {
      const x = P + colW * i + colW / 2;
      let vs = 60;
      while (vs > 30 && measure(col.v, { size: vs, mono: true }) > colW - 20) vs -= 4;
      text(col.v, x, 374, { size: vs, mono: true, color: col.color, align: 'center' });
      text(col.l, x, 414, { size: 22, weight: 600, color: TEXT3, align: 'center', spacing: 3 });
    });
  }
  return canvas;
}

/** The all-goals story: one total ring, then a bar per goal of the year. */
export async function renderYearStory(data: YearStoryData): Promise<HTMLCanvasElement> {
  const { canvas, c, text, measure, panel, ring } = await setup(STORY_W, STORY_H);
  const t = data.total;
  const accent = t.complete ? EMBER : VIOLET;
  const innerW = STORY_W - PAD * 2;
  paintBackground(c);

  // ── Header ──
  const headerY = SAFE_TOP + 50;
  paintMark(c, PAD, headerY);
  text('Climbing', PAD + 74, headerY, { size: 40, weight: 700 });
  text(data.dateLabel, STORY_W - PAD, headerY, { size: 36, color: TEXT2, align: 'right', mono: true });

  // ── Total hero ──
  const heroTop = headerY + 76;
  const badge = `${data.year} GOALS`;
  const badgeOpts: TextOpts = { size: 30, weight: 700, spacing: 2 };
  c.beginPath();
  c.roundRect(PAD, heroTop, measure(badge, badgeOpts) + 56, 64, 32);
  c.fillStyle = t.complete ? 'rgba(240,162,74,0.16)' : 'rgba(155,140,255,0.16)';
  c.fill();
  text(badge, PAD + 28, heroTop + 43, { ...badgeOpts, color: accent });

  const ringR = 130;
  const ringCx = STORY_W - PAD - ringR - 16;
  const maxNumW = ringCx - ringR - 40 - PAD;
  const targetStr = `/${t.target}`;
  let numSize = 180;
  const widthAt = (sz: number) => measure(String(t.done), { size: sz, mono: true }) + measure(targetStr, { size: sz * 0.36, mono: true });
  while (numSize > 90 && widthAt(numSize) > maxNumW) numSize -= 8;
  const numY = heroTop + 96 + numSize * 0.74;
  text(String(t.done), PAD, numY, { size: numSize, mono: true });
  text(targetStr, PAD + measure(String(t.done), { size: numSize, mono: true }) + 6, numY, { size: numSize * 0.36, mono: true, color: TEXT2 });
  const paceY = numY + 66;
  const count = data.goals.length;
  text(count ? `${t.pace} · ${count} ${count === 1 ? 'goal' : 'goals'}` : 'No goals yet', PAD, paceY, { size: 42, weight: 600, color: t.complete ? EMBER : TEXT2 });

  const ringCy = heroTop + (paceY - heroTop) / 2 + 6;
  ring(ringCx, ringCy, ringR, 30, t.pct, t.complete);
  text(`${t.pct}%`, ringCx, ringCy + 18, { size: 76, weight: 700, mono: true, color: accent, align: 'center' });
  text(t.complete ? 'DONE' : 'OF GOALS', ringCx, ringCy + 64, { size: 24, weight: 600, color: TEXT3, align: 'center', spacing: 3 });

  // ── One row per goal ──
  const listTop = paceY + 68;
  const footY = SAFE_BOTTOM - 8;
  const listH = footY - 56 - listTop;
  panel(PAD, listTop, innerW, listH);
  if (count === 0) {
    text(`Add a goal for ${data.year} in the Log tab.`, STORY_W / 2, listTop + listH / 2, { size: 36, color: TEXT2, align: 'center' });
  } else {
    const MAX_ROWS = 8;
    const shown = data.goals.slice(0, MAX_ROWS);
    const more = count - shown.length;
    const rowsH = listH - 48 - (more > 0 ? 60 : 0);
    const rowH = Math.min(170, rowsH / shown.length);
    const k = Math.min(1, rowH / 150); // smaller text when many goals share the panel
    const x0 = PAD + 44, x1 = PAD + innerW - 44;
    const top = listTop + 24 + (rowsH - rowH * shown.length) / 2;
    shown.forEach((row, i) => {
      const y = top + rowH * i;
      const base = y + rowH * 0.42;
      if (i > 0) {
        c.fillStyle = LINE;
        c.fillRect(x0, y, x1 - x0, 2);
      }
      text(row.grade, x0, base, { size: 48 * k, weight: 700 });
      text(row.typeLabel, x0 + measure(row.grade, { size: 48 * k, weight: 700 }) + 16, base, { size: 34 * k, color: TEXT2 });
      const tStr = `/${row.target}`;
      const tW = measure(tStr, { size: 30 * k, mono: true });
      text(tStr, x1, base, { size: 30 * k, mono: true, color: TEXT2, align: 'right' });
      text(String(row.done), x1 - tW - 4, base, { size: 48 * k, mono: true, color: row.complete ? EMBER : TEXT1, align: 'right' });
      const barY = base + 26 * k, barH = Math.max(10, 18 * k);
      c.beginPath();
      c.roundRect(x0, barY, x1 - x0, barH, barH / 2);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fill();
      if (row.pct > 0) {
        c.beginPath();
        c.roundRect(x0, barY, Math.max(barH, ((x1 - x0) * row.pct) / 100), barH, barH / 2);
        c.fillStyle = row.complete ? EMBER : VIOLET;
        c.fill();
      }
      text(row.pace, x0, barY + barH + 36 * k, { size: 26 * k, color: row.complete ? EMBER : TEXT3 });
      text(`${row.pct}%`, x1, barY + barH + 36 * k, { size: 26 * k, mono: true, color: TEXT3, align: 'right' });
    });
    if (more > 0) text(`+${more} more`, STORY_W / 2, listTop + listH - 40, { size: 30, color: TEXT3, align: 'center' });
  }

  text(`${data.year} · climbing log`, STORY_W / 2, footY, { size: 26, color: TEXT3, align: 'center', spacing: 2 });
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
