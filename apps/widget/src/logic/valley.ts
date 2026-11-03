// The valley widget's still picture, as one SVG string. No React Native imports, so tests can load it.
import { mountainShape, SKY, TILE, type DeviceWorld } from '@journaling/core/world';

/** The sky plus the two habit-plant rows. Animals, water and the lower field don't read at widget size. */
export const SCENE_H = SKY + TILE * 2;
const MAX_FLAGS = 6;
/** A plant never reaches past this, so its top stays in the picture. */
const TOP_MARGIN = 4;

const SKY_TOP = '#0B0D14';
const SKY_MID = '#3B2747';
const SKY_LOW = '#F0A24A';
const HILL = '#3B2F55';
const FIELD = '#4F9A4E';
const FIELD_BACK = '#447F45';
const FLAG = '#F0A24A';
const TRUNK = '#7A5230';
const LEAF = '#2F7A3E';
const STEM = '#3E8A3A';
const PETAL = '#F5C542';
const SEED = '#8A5A1E';
const CANE = '#8DBF6A';
const STAR = '#FFFFFF';

type Plant = DeviceWorld['plants'][number];

const r1 = (n: number) => Math.round(n * 10) / 10;
const baseOf = (p: Plant) => SKY + (p.row + 1) * TILE - 2;

/** The y of a plant's top, in scene units. */
export function plantTop(p: Plant): number {
  return Math.max(TOP_MARGIN, baseOf(p) - p.tiles * TILE);
}

function plantSvg(p: Plant, i: number): string {
  const x = p.col * TILE + TILE / 2;
  const by = baseOf(p);
  const top = plantTop(p);
  const h = by - top;
  let body = '';
  if (p.kind === 'tree') {
    const crown = Math.max(5, h * 0.55);
    const w = Math.min(7, 3.5 + p.tiles);
    body = `<rect x="${r1(x - 1.5)}" y="${r1(top + crown * 0.6)}" width="3" height="${r1(by - top - crown * 0.6)}" fill="${TRUNK}"/>`
      + `<ellipse cx="${r1(x)}" cy="${r1(top + crown / 2)}" rx="${r1(w)}" ry="${r1(crown / 2)}" fill="${LEAF}"/>`;
  } else if (p.kind === 'sun') {
    const head = Math.min(4.5, 2.5 + p.tiles * 0.5);
    body = `<line x1="${r1(x)}" y1="${r1(by)}" x2="${r1(x)}" y2="${r1(top + head)}" stroke="${STEM}" stroke-width="1.6"/>`
      + `<circle cx="${r1(x)}" cy="${r1(top + head)}" r="${r1(head)}" fill="${PETAL}"/>`
      + `<circle cx="${r1(x)}" cy="${r1(top + head)}" r="${r1(head * 0.4)}" fill="${SEED}"/>`;
  } else {
    const nodes = Math.max(1, Math.floor(h / 8));
    const knots = Array.from({ length: nodes }, (_, k) => `<line x1="${r1(x - 3)}" x2="${r1(x + 1)}" y1="${r1(by - (k + 1) * 8)}" y2="${r1(by - (k + 1) * 8)}" stroke="${LEAF}" stroke-width="0.8"/>`).join('');
    body = `<rect x="${r1(x - 3)}" y="${r1(top)}" width="2" height="${r1(h)}" fill="${CANE}"/>`
      + `<rect x="${r1(x)}" y="${r1(top + h * 0.2)}" width="1.6" height="${r1(h * 0.8)}" fill="${CANE}"/>` + knots;
  }
  return `<g id="plant-${i}">${body}</g>`;
}

/** Flags walk down the left ridge from the peak, one per grade step. */
function flagsSvg(count: number, sceneW: number): string {
  const pts = mountainShape(sceneW);
  const [px, py] = pts[3];
  const [lx, ly] = pts[1];
  return Array.from({ length: Math.min(MAX_FLAGS, count) }, (_, i) => {
    const t = i / MAX_FLAGS;
    const x = px + (lx - px) * t * 0.9;
    const y = py + (ly - py) * t * 0.9;
    return `<g id="flag-${i}"><line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(y - 7)}" stroke="${STAR}" stroke-width="0.8"/>`
      + `<path d="M${r1(x)} ${r1(y - 7)} l4 1.5 l-4 1.5 z" fill="${FLAG}"/></g>`;
  }).join('');
}

/** Sky kept above the highest thing drawn, so the stars still show. */
const SKY_ROOM = 14;
/** Without a mountain or tall plants, the sky still shows this much. */
const LOW_TOP = SKY - 40;

/** The top of the picture: empty sky above the tallest plant or the peak is cut, so the valley fills a wide widget. */
export function viewTop(world: DeviceWorld): number {
  const tops = [LOW_TOP, ...world.plants.map(plantTop), ...(world.mountain ? [mountainShape(world.cols * TILE)[3][1] - 8] : [])];
  return Math.max(0, Math.min(...tops) - SKY_ROOM);
}

/** The picture at w×h px. A wider widget shows more sky and field on both sides; the scene never stretches. */
export function valleySvg(world: DeviceWorld, w: number, h: number): string {
  const sceneW = world.cols * TILE;
  const y0 = viewTop(world);
  const viewH = SCENE_H - y0;
  const viewW = Math.max(sceneW, (viewH * w) / h);
  const x0 = (sceneW - viewW) / 2;
  const stars = world.stars.map((s) => `<circle cx="${r1(s.x)}" cy="${r1(s.y)}" r="0.7" fill="${STAR}" opacity="0.8"/>`).join('');
  const hill = world.mountain
    ? `<polygon id="mountain" points="${mountainShape(sceneW).map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ')}" fill="${HILL}"/>` + flagsSvg(world.flags, sceneW)
    : '';
  // Back row first, so the front row stands in front of it.
  const plants = world.plants
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.row - b.p.row)
    .map(({ p, i }) => plantSvg(p, i))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${r1(x0)} ${r1(y0)} ${r1(viewW)} ${r1(viewH)}">`
    + `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY_TOP}"/><stop offset="0.6" stop-color="${SKY_MID}"/><stop offset="1" stop-color="${SKY_LOW}"/></linearGradient></defs>`
    + `<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(viewW)}" height="${r1(SKY - y0)}" fill="url(#sky)"/>`
    + stars + hill
    + `<rect x="${r1(x0)}" y="${SKY}" width="${r1(viewW)}" height="${TILE}" fill="${FIELD_BACK}"/>`
    + `<rect x="${r1(x0)}" y="${SKY + TILE}" width="${r1(viewW)}" height="${TILE}" fill="${FIELD}"/>`
    + plants
    + '</svg>';
}

const tilesText = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return `${v} ${v === 1 ? 'tile' : 'tiles'}`;
};

/** The share of this week's usual habits that plants something, as in the valley. */
const GOAL_SHARE = 0.8;

/** One line under the picture: planted this week wins, then the tallest plant and how many habits plant this week. */
export function valleyLine(world: DeviceWorld): string {
  if (world.week.met) return 'Planted this week';
  const parts: string[] = [];
  if (world.tallest && world.tallest.tiles >= 1) parts.push(`${world.tallest.name} is ${tilesText(world.tallest.tiles)} tall`);
  if (world.week.total > 0) parts.push(`${world.week.done} of ${Math.ceil(GOAL_SHARE * world.week.total)} habits to plant`);
  return parts.length ? parts.join(' · ') : 'Your valley';
}
