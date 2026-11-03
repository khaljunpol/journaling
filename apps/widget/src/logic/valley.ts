// The valley widget's still picture, as one SVG string, drawn with the app's own pixel sprites.
// No React Native imports, so tests can load it.
import { PALETTE, SEASON, SPRITES, type SpriteId } from '@journaling/core/sprites';
import { BASE_COLS, displayCol, mountainShape, sceneLeft, SKY, TILE, type DeviceWorld, type PlantKind } from '@journaling/core/world';

/** The field's width: the picture is centred on it, as in the app. */
const FW = BASE_COLS * TILE;
/** Rows shown under the horizon: the two habit-plant rows and the first two field rows. */
const ROWS = 4;
/** The sky plus four rows. Water and the lower field don't read at widget size. */
export const SCENE_H = SKY + TILE * ROWS;
const MAX_FLAGS = 6;
/** A plant never reaches past this, so its top stays in the picture. */
const TOP_MARGIN = 4;
/** Sky kept above the highest thing drawn, so the stars still show. */
const SKY_ROOM = 14;
/** Without a mountain or tall plants, the sky still shows this much. */
const LOW_TOP = SKY - 40;

const STAGE = ['seed', 'sprout', 'sapling', 'young'] as const;
const PREFIX: Record<PlantKind, string> = { tree: 'tree', sun: 'sun', bamboo: 'bam' };

type Plant = DeviceWorld['plants'][number];
type Pal = Record<string, string>;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One sprite as rects at 0,0; a run of one colour in a row is one rect. `skip`: a colour already under it. */
function rects(id: SpriteId, pal: Pal, skip?: string): string {
  let out = '';
  SPRITES[id].forEach((row, ry) => {
    let cx = 0;
    while (cx < 16) {
      const ch = row[cx];
      let end = cx + 1;
      while (end < 16 && row[end] === ch) end += 1;
      if (ch !== '.' && pal[ch] && pal[ch] !== skip) out += `<rect x="${cx}" y="${ry}" width="${end - cx}" height="1" fill="${pal[ch]}"/>`;
      cx = end;
    }
  });
  return out;
}

/** Draws sprites by reference: each sprite's pixels are written once in <defs>, then reused. Keeps the SVG small. */
type Draw = (id: SpriteId, x: number, y: number, size?: number, flip?: boolean) => string;
function sheet(): { draw: Draw; defs: (pal: Pal) => string } {
  const used = new Set<SpriteId>();
  const draw: Draw = (id, x, y, size = TILE, flip = false) => {
    used.add(id);
    const k = size / 16;
    const t = flip ? `translate(${r1(x + size)} ${r1(y)}) scale(${-k} ${k})` : `translate(${r1(x)} ${r1(y)})${k === 1 ? '' : ` scale(${k})`}`;
    return `<use href="#s-${id}" xlink:href="#s-${id}" transform="${t}"/>`;
  };
  const defs = (pal: Pal) => [...used].map((id) => `<g id="s-${id}">${rects(id, pal)}</g>`).join('');
  return { draw, defs };
}

const baseOf = (p: Plant) => SKY + (p.row + 1) * TILE;
const heightOf = (p: Plant) => (p.stage < 4 ? TILE : Math.round(p.tiles * TILE));

/** The y of a plant's top, in scene units. */
export function plantTop(p: Plant): number {
  return Math.max(TOP_MARGIN, baseOf(p) - heightOf(p));
}

/** A habit plant as in the app: its growth stage in one tile, or a stem of parts with a head, taller with every day done. */
function plantSvg(p: Plant, i: number, draw: Draw): string {
  const x = displayCol(p.col) * TILE;
  const base = baseOf(p);
  if (p.stage < 4) return `<g id="plant-${i}">${draw(`${PREFIX[p.kind]}-${STAGE[p.stage as 0 | 1 | 2 | 3]}` as SpriteId, x, base - TILE)}</g>`;
  const top = plantTop(p);
  let body = '';
  let n = 0;
  for (let y = base - TILE; y > top; y -= TILE, n++) {
    const seg: SpriteId = p.kind === 'tree' ? 'tree-trunk' : p.kind === 'sun' ? (n % 2 ? 'sun-stem2' : 'sun-stem') : 'bam-seg';
    body += draw(seg, x, y);
  }
  const head: SpriteId = p.kind === 'tree' ? 'tree-crown' : p.kind === 'sun' ? 'sun-head' : 'bam-top';
  return `<g id="plant-${i}">${body}${draw(head, x, top)}</g>`;
}

/** The mountain as in the app: body, lit face and snow cap. Flags walk up the left face, one per grade step. */
function mountainSvg(flags: number, draw: Draw): string {
  const mount = mountainShape(FW) as Array<[number, number]>;
  const peak = mount[3];
  const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
  let out = `<g id="mountain"><polygon points="${pts(mount)}" fill="#3B2F55"/>`
    + `<polygon points="${pts([peak, mount[4], [FW * 0.62, SKY], [FW * 0.56, 70]])}" fill="#4A3C6A"/>`
    + `<polygon points="${pts([peak, [peak[0] - 7, peak[1] + 10], [peak[0] - 2, peak[1] + 8], [peak[0] + 2, peak[1] + 12], [peak[0] + 7, peak[1] + 9]])}" fill="#EDE7F6"/></g>`;
  const [ax, ay] = mount[0];
  const count = Math.min(MAX_FLAGS, flags);
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    out += `<g id="flag-${i}">${draw('flag', ax + (peak[0] - ax) * t, ay + (peak[1] - ay) * t - 16)}</g>`;
  }
  return out;
}

const tileXY = (t: number) => ({ x: (t % BASE_COLS) * TILE, y: SKY + Math.floor(t / BASE_COLS) * TILE });
const shown = (t: number) => Math.floor(t / BASE_COLS) < ROWS;

/** The first field rows: young plantings, hives and animals, as in the app. */
function fieldSvg(world: DeviceWorld, draw: Draw): string {
  let out = '';
  for (const p of world.plantings ?? []) {
    if (!shown(p.tile)) continue;
    const { x, y } = tileXY(p.tile);
    const size = p.kind === 'tree' ? TILE : 12;
    out += draw(`${PREFIX[p.kind]}-young` as SpriteId, x + (TILE - size) / 2, y + TILE - size, size);
  }
  for (const t of world.hives ?? []) if (shown(t)) { const { x, y } = tileXY(t); out += draw('hive', x, y); }
  for (const a of world.animals ?? []) if (shown(a.tile)) { const { x, y } = tileXY(a.tile); out += draw(`${a.kind}-1` as SpriteId, x, y, TILE, a.tile % 2 === 0); }
  return out;
}

/** The top of the picture: empty sky above the tallest plant or the peak is cut, so the valley fills a wide widget. */
export function viewTop(world: DeviceWorld): number {
  const tops = [LOW_TOP, ...world.plants.map(plantTop), ...(world.mountain ? [mountainShape(FW)[3][1] - 22] : [])];
  return Math.max(0, Math.min(...tops) - SKY_ROOM);
}

/** The picture at w×h px. A wider widget shows more sky and grass on both sides; the scene never stretches. */
export function valleySvg(world: DeviceWorld, w: number, h: number): string {
  const pal: Pal = { ...PALETTE, ...(SEASON[world.season] ?? {}) };
  const { draw, defs } = sheet();
  const sceneW = world.cols * TILE;
  const y0 = viewTop(world);
  const viewH = SCENE_H - y0;
  const viewW = Math.max(sceneW, (viewH * w) / h);
  const x0 = (FW - viewW) / 2;
  // Sky spots run from 0 to the scene width; the scene starts at sceneLeft.
  const shift = sceneLeft(world.cols) * TILE;
  const stars = world.stars.map((s) => `<rect x="${r1(s.x + shift)}" y="${r1(s.y)}" width="1" height="1" fill="#FFF6DD"/>`).join('');
  // Back row first, so the front row stands in front of it.
  const plants = world.plants
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.row - b.p.row)
    .map(({ p, i }) => plantSvg(p, i, draw))
    .join('');
  const band = viewH * 0.32;
  // Drawn first, so the sheet knows which sprites to define.
  const body = `<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(viewW)}" height="${r1(SKY - y0)}" fill="url(#sky)"/>`
    + stars
    + (world.mountain ? mountainSvg(world.flags, draw) : '')
    + `<rect x="${r1(x0)}" y="${SKY}" width="${r1(viewW)}" height="${TILE * ROWS}" fill="${pal.g}"/>`
    + `<rect x="${r1(x0)}" y="${SKY}" width="${r1(viewW)}" height="${TILE * ROWS}" fill="url(#grass)"/>`
    + fieldSvg(world, draw) + plants
    // A dark band at the bottom, so the line on top of it stays readable.
    + `<rect x="${r1(x0)}" y="${r1(SCENE_H - band)}" width="${r1(viewW)}" height="${r1(band)}" fill="url(#fade)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${r1(x0)} ${r1(y0)} ${r1(viewW)} ${r1(viewH)}" shape-rendering="crispEdges">`
    + `<defs><linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${SKY}"><stop offset="0" stop-color="#0B0D14"/><stop offset="0.55" stop-color="#3B2747"/><stop offset="1" stop-color="#F0A24A"/></linearGradient>`
    // The grass texture as one repeating tile, the same as the app's field.
    + `<pattern id="grass" patternUnits="userSpaceOnUse" x="0" y="${SKY}" width="${TILE}" height="${TILE}">${rects('grass', pal, pal.g)}</pattern>`
    + `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0D14" stop-opacity="0"/><stop offset="1" stop-color="#0B0D14" stop-opacity="0.85"/></linearGradient>`
    + defs(pal) + '</defs>'
    + body + '</svg>';
}

const tilesText = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return `${v} ${v === 1 ? 'tile' : 'tiles'}`;
};

/** The share of this week's usual habits that plants something, as in the valley. */
const GOAL_SHARE = 0.8;

/** One line on the picture: planted this week wins, then the tallest plant and how many habits plant this week. */
export function valleyLine(world: DeviceWorld): string {
  if (world.week.met) return 'Planted this week';
  const parts: string[] = [];
  if (world.tallest && world.tallest.tiles >= 1) parts.push(`${world.tallest.name} is ${tilesText(world.tallest.tiles)} tall`);
  if (world.week.total > 0) parts.push(`${world.week.done} of ${Math.ceil(GOAL_SHARE * world.week.total)} habits to plant`);
  return parts.length ? parts.join(' · ') : 'Your valley';
}
