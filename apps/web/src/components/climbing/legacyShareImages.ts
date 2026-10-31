// The three older share-image styles (Centered, Compact, Bold). They draw a canvas and download a PNG.
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';
import type { LogEntry } from './types';

export type Progress = { yr: number; ordinal: number; target: number };
/** Loads the year progress for one log (its send number and the goal target). */
export type ProgressFn = (l: { id?: string; date: string; type: 'boulder' | 'rope'; grade: string }) => Promise<Progress>;

// Shared canvas setup
function createOverlayCanvas() {
  const W = CANVAS_WIDTH, H = CANVAS_HEIGHT;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, W, H);
  const font = 'Inter, system-ui, -apple-system, Segoe UI, Roboto';
  const accent = '#fc4c02';
  const green = '#22c55e';
  const muted = '#ffffff';
  const dim = 'rgba(255,255,255,0.85)';
  const shadow = () => { c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 28; c.shadowOffsetX = 0; c.shadowOffsetY = 2; };
  const noShadow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
  // write draws text twice for extra shadow punch on bright backgrounds
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
  const drawBadge = (text: string, y: number) => {
    c.font = `700 72px ${font}`;
    const bw = c.measureText(text).width + 90;
    const bh = 96;
    shadow();
    c.beginPath(); c.roundRect(W / 2 - bw / 2, y, bw, bh, 22);
    c.fillStyle = accent; c.fill(); noShadow();
    c.textAlign = 'center'; c.font = `700 72px ${font}`; c.fillStyle = '#fff';
    shadow(); c.fillText(text, W / 2, y + 68); noShadow();
    return { bw, bh };
  };
  const drawMeter = (x: number, y: number, w: number, h: number, pct: number) => {
    const r = h / 2;
    c.beginPath(); c.roundRect(x, y, w, h, r);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill();
    const fw = Math.max(h, Math.round(w * Math.min(1, pct / 100)));
    shadow();
    c.beginPath(); c.roundRect(x, y, fw, h, r);
    c.fillStyle = pct >= 100 ? green : accent; c.fill();
    noShadow();
  };
  return { canvas, c, W, H, write, accent, green, muted, dim, font, shadow, noShadow, download, drawBadge, drawMeter };
}

// Version 1: Centered — badge + meter + stats
export async function createOverlayV1(l: LogEntry, getProgress: ProgressFn) {
  try {
    const dateISO = String(l.date).slice(0, 10);
    const { yr, ordinal, target } = await getProgress({ ...l, date: dateISO });
    const { W, H, write, accent, muted, dim, download, drawBadge, drawMeter } = createOverlayCanvas();
    const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
    const cx = W / 2;
    const padX = 100;

    const baseY = H * 0.42;
    const { bh } = drawBadge(l.grade.toUpperCase(), baseY);

    write('SENT!', 40, cx, baseY + bh + 56, { bold: true, color: muted });

    // Meter
    const meterY = baseY + bh + 120;
    const meterW = W - padX * 2;
    const meterH = 40;
    drawMeter(padX, meterY, meterW, meterH, pct);

    if (target > 0) {
      write(`${ordinal} / ${target}`, 64, padX, meterY - 16, { bold: true, align: 'left' });
      write(`${pct}%`, 64, W - padX, meterY - 16, { bold: true, color: accent, align: 'right' });
      write(`${yr} GOAL`, 26, cx, meterY + meterH + 40, { color: dim });
    } else {
      write(`Send #${ordinal}`, 52, padX, meterY - 16, { bold: true, align: 'left' });
    }

    // Stats
    const statsY = meterY + meterH + (target > 0 ? 110 : 70);
    const stats = [
      { label: 'TYPE', value: l.type === 'boulder' ? 'Boulder' : 'Rope' },
      { label: 'SESSION', value: `#${l.session}` },
      { label: 'ATTEMPTS', value: l.attempts === 0 ? 'Flash' : String(l.attempts) },
    ];
    const sp = W / (stats.length + 1);
    stats.forEach((s, i) => {
      write(s.value, 48, sp * (i + 1), statsY, { bold: true });
      write(s.label, 22, sp * (i + 1), statsY + 38, { color: muted });
    });

    download(`climb-${l.id}.png`);
  } catch { /* no-op */ }
}

// Version 2: Compact bottom — everything at the very bottom, minimal
export async function createOverlayV2(l: LogEntry, getProgress: ProgressFn) {
  try {
    const dateISO = String(l.date).slice(0, 10);
    const { yr, ordinal, target } = await getProgress({ ...l, date: dateISO });
    const { W, H, write, accent, muted, dim, download, drawMeter } = createOverlayCanvas();
    const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
    const padX = 80;

    // Everything anchored to bottom
    const bottomBase = H - 200;

    // Grade big text
    write(l.grade.toUpperCase(), 120, padX, bottomBase - 180, { bold: true, color: accent, align: 'left' });
    write('SENT', 48, padX, bottomBase - 110, { bold: true, align: 'left' });

    // Meter
    const meterW = W - padX * 2;
    drawMeter(padX, bottomBase - 50, meterW, 32, pct);

    if (target > 0) {
      write(`${ordinal}/${target}`, 56, padX, bottomBase + 48, { bold: true, align: 'left' });
      write(`${pct}%`, 56, W - padX, bottomBase + 48, { bold: true, color: accent, align: 'right' });
    }

    // Inline stats
    const inlineY = target > 0 ? bottomBase + 110 : bottomBase + 60;
    const attText = l.attempts === 0 ? 'Flash' : `${l.attempts} att`;
    const typeName = l.type === 'boulder' ? 'Boulder' : 'Rope';
    write(`${typeName}  ·  S${l.session}  ·  ${attText}`, 28, padX, inlineY, { color: muted, align: 'left' });

    if (target > 0) {
      write(`${yr} Goal`, 22, W - padX, inlineY, { color: dim, align: 'right' });
    }

    download(`climb-${l.id}-compact.png`);
  } catch { /* no-op */ }
}

// Version 3: Left-aligned bold — large grade hero with side stats
export async function createOverlayV3(l: LogEntry, getProgress: ProgressFn) {
  try {
    const dateISO = String(l.date).slice(0, 10);
    const { yr, ordinal, target } = await getProgress({ ...l, date: dateISO });
    const { W, H, write, accent, green, muted, dim, download, drawMeter } = createOverlayCanvas();
    const pct = target ? Math.min(100, Math.round((ordinal / target) * 100)) : 0;
    const padX = 100;

    const baseY = H * 0.48;

    // Huge grade left-aligned
    write(l.grade.toUpperCase(), 160, padX, baseY, { bold: true, color: accent, align: 'left' });
    write('SENT', 56, padX, baseY + 60, { bold: true, align: 'left' });

    // Stats column below
    const statsX = padX;
    const statsY = baseY + 130;
    const lineH = 70;
    const stats = [
      { label: 'Type', value: l.type === 'boulder' ? 'Boulder' : 'Rope' },
      { label: 'Session', value: `#${l.session}` },
      { label: 'Attempts', value: l.attempts === 0 ? 'Flash' : String(l.attempts) },
    ];
    stats.forEach((s, i) => {
      const sy = statsY + i * lineH;
      write(s.label.toUpperCase(), 22, statsX, sy, { color: muted, align: 'left' });
      write(s.value, 38, statsX + 220, sy, { bold: true, align: 'left' });
    });

    // Meter at bottom of stats
    if (target > 0) {
      const meterY = statsY + stats.length * lineH + 30;
      const meterW = W - padX * 2;
      drawMeter(padX, meterY, meterW, 36, pct);
      write(`${ordinal}/${target}`, 56, padX, meterY + 96, { bold: true, align: 'left' });
      write(`${pct}%`, 56, W - padX, meterY + 96, { bold: true, color: pct >= 100 ? green : accent, align: 'right' });
      write(`${yr} Goal`, 24, padX, meterY + 136, { color: dim, align: 'left' });
    }

    download(`climb-${l.id}-bold.png`);
  } catch { /* no-op */ }
}
