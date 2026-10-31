import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { dark } from '@journaling/design';
import type { HabitIcon } from '@journaling/core/habitIcons';
import { shownHabits } from '../logic/queue';
import type { Snapshot } from '../sync';

const c = dark as unknown as Record<keyof typeof dark, ColorProp>;
const PAD = 8;
const GAP = 5;
const RADIUS = 12;
/** A done item: the violet tint and outline, softer than a solid fill next to colourful emoji. */
const ON_BG: ColorProp = 'rgba(155, 140, 255, 0.22)';

export const FACES = [
  { emoji: '😞', scores: [0, 1, 2] },
  { emoji: '😐', scores: [3, 4] },
  { emoji: '🙂', scores: [5, 6] },
  { emoji: '😄', scores: [7, 8] },
  { emoji: '🤩', scores: [9, 10] },
];
const faceOf = (mood: number | null) => (mood === null ? -1 : FACES.findIndex((f) => f.scores.includes(mood)));

const GLYPHS: Record<HabitIcon, string> = {
  gym: '🏋', hiit: '🔥', bodyweight: '💪', racket: '🎾', climb: '🧗', run: '🏃', swim: '🏊', bike: '🚴', yoga: '🧘',
  beer: '🍺', wine: '🍷', smoke: '🚬', coffee: '☕', water: '💧', shake: '🥤', pill: '💊',
  read: '📖', meditate: '🧠', music: '🎵', write: '✍', games: '🎮', heart: '❤',
};

type Box = { w: number; h: number };
type Press = { action?: { name: string; data?: Record<string, unknown> }; uri?: string };

/** Width of n equal tiles across the inside of a widget. */
const cell = (width: number, n: number) => Math.floor((width - PAD * 2 - GAP * (n - 1)) / n);

function clickOf({ action, uri }: Press) {
  return uri ? { clickAction: 'OPEN_URI', clickActionData: { uri } } : { clickAction: action?.name, clickActionData: action?.data };
}

function Tile({ box, label, on, text, first, ...press }: Press & { box: Box; label: string; on?: boolean; text?: boolean; first?: boolean }) {
  const short = Math.min(box.w, box.h);
  return (
    <FlexWidget
      {...clickOf(press)}
      style={{
        width: box.w, height: box.h, marginLeft: first ? 0 : GAP, borderRadius: RADIUS,
        backgroundColor: on ? ON_BG : c['surface-2'], borderWidth: 1, borderColor: on ? c.accent : c['surface-2'],
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <TextWidget
        text={label}
        style={text
          ? { fontSize: Math.min(13, Math.round(box.w * 0.3)), fontWeight: '600', color: c['text-1'] }
          : { fontSize: Math.round(Math.min(short * 0.5, 24)), color: c['text-1'] }}
      />
    </FlexWidget>
  );
}

function ringSvg(filled: number, total: number, size: number): string {
  const r = 15;
  const len = 2 * Math.PI * r;
  const done = total > 0 && filled >= total;
  const share = total > 0 ? Math.min(1, filled / total) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${dark['surface-3']}" stroke-width="3.5"/>
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${done ? dark.reward : dark.accent}" stroke-width="3.5" stroke-linecap="round"
      stroke-dasharray="${len * share} ${len}" transform="rotate(-90 18 18)"/>
    <text x="18" y="22" font-family="sans-serif" font-size="10" font-weight="600" text-anchor="middle" fill="${dark['text-1']}">${filled}/${total}</text>
  </svg>`;
}

function Ring({ s, box }: { s: Snapshot; box: Box }) {
  const p = s.state?.progress ?? { filled: 0, total: 0 };
  const size = Math.min(box.w, box.h) - 2;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `${s.conn?.url}/quick` }}
      style={{ width: box.w, height: box.h, marginLeft: GAP, justifyContent: 'center', alignItems: 'center' }}
    >
      <SvgWidget svg={ringSvg(p.filled, p.total, size)} style={{ width: size, height: size }} />
    </FlexWidget>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.surface, borderRadius: 20, padding: PAD, justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </FlexWidget>
  );
}

const Row = ({ children, top }: { children: React.ReactNode; top?: boolean }) => (
  <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: top ? GAP : 0 }}>{children}</FlexWidget>
);

function Message({ text }: { text: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.surface, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 14, color: c['text-2'] }} />
    </FlexWidget>
  );
}

const habits = (s: Snapshot, max: number, box: Box, firstInRow: boolean) =>
  shownHabits(s.state?.habits ?? [], s.picked, max).map((h, i) => (
    <Tile
      key={h.id}
      box={box}
      first={firstInRow && i === 0}
      label={h.icon ? GLYPHS[h.icon] : h.name.slice(0, 1).toUpperCase()}
      text={!h.icon}
      on={h.done}
      action={{ name: 'HABIT', data: { id: h.id } }}
    />
  ));

const weightTile = (s: Snapshot, box: Box) => {
  const w = s.state?.weight;
  return <Tile box={box} label={w != null ? String(w) : '⚖'} text={w != null} on={w != null} uri="journalwidget://weight" />;
};

const hoursTile = (s: Snapshot, box: Box) => {
  const n = s.state?.hours ?? 0;
  const label = n ? `${n}h` : s.noUsualHours ? 'Set' : '⏱';
  return <Tile box={box} label={label} text={label !== '⏱'} on={n >= 24} action={{ name: 'HOURS' }} />;
};

function early(s: Snapshot): React.JSX.Element | null {
  if (!s.conn) return <Message text="Tap to connect" />;
  if (s.keyBad) return <Message text="Key not valid" />;
  if (!s.state) return <Message text="Loading" />;
  return null;
}

type Size = { s: Snapshot; width: number; height: number };

/** Two rows that fill the widget: 5 faces and the ring, then up to 6 habits, weight and hours. */
export function JournalLarge({ s, width, height }: Size) {
  const stop = early(s);
  if (stop) return stop;
  const face = faceOf(s.state?.mood ?? null);
  const h = Math.floor((height - PAD * 2 - GAP) / 2);
  const top: Box = { w: cell(width, 6), h };
  const low: Box = { w: cell(width, 8), h };
  const count = shownHabits(s.state?.habits ?? [], s.picked, 6).length;
  // Fewer habits: the weight and hours tiles widen, so the row still ends at the edge.
  const spare = Math.floor(((6 - count) * (low.w + GAP)) / 2);
  const wide: Box = { w: low.w + spare, h };
  return (
    <Shell>
      <Row>
        {FACES.map((f, i) => (
          <Tile key={f.emoji} box={top} first={i === 0} label={f.emoji} on={i === face} uri={`journalwidget://mood?face=${i}`} />
        ))}
        <Ring s={s} box={top} />
      </Row>
      <Row top>
        {habits(s, 6, low, true)}
        {weightTile(s, wide)}
        {hoursTile(s, wide)}
      </Row>
    </Shell>
  );
}

/** One row with everything: mood, 4 habits, weight, hours, ring. */
export function JournalSmall({ s, width, height }: Size) {
  const stop = early(s);
  if (stop) return stop;
  const face = faceOf(s.state?.mood ?? null);
  const box: Box = { w: cell(width, 8), h: Math.min(height - PAD * 2, 56) };
  const count = shownHabits(s.state?.habits ?? [], s.picked, 4).length;
  const wide: Box = { ...box, w: box.w + Math.floor(((4 - count) * (box.w + GAP)) / 3) };
  return (
    <Shell>
      <Row>
        <Tile box={wide} first label={face >= 0 ? FACES[face].emoji : '🙂'} on={face >= 0} uri="journalwidget://mood" />
        {habits(s, 4, box, false)}
        {weightTile(s, wide)}
        {hoursTile(s, wide)}
        <Ring s={s} box={box} />
      </Row>
    </Shell>
  );
}
