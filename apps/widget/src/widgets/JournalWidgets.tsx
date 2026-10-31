import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { dark } from '@journaling/design';
import type { HabitIcon } from '@journaling/core/habitIcons';
import { shownHabits } from '../logic/queue';
import type { Snapshot } from '../sync';

const c = dark as unknown as Record<keyof typeof dark, ColorProp>;

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

function ring(filled: number, total: number, size: number): string {
  const r = 15;
  const len = 2 * Math.PI * r;
  const done = total > 0 && filled >= total;
  const share = total > 0 ? Math.min(1, filled / total) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${dark['surface-3']}" stroke-width="4"/>
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${done ? dark.reward : dark.accent}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${len * share} ${len}" transform="rotate(-90 18 18)"/>
    <text x="18" y="22" font-size="10" font-weight="600" text-anchor="middle" fill="${dark['text-1']}">${filled}/${total}</text>
  </svg>`;
}

function Shell({ children, row }: { children: React.ReactNode; row?: boolean }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent', width: 'match_parent', backgroundColor: c.surface, borderRadius: 18, padding: 8,
        flexDirection: row ? 'row' : 'column', alignItems: row ? 'center' : undefined, justifyContent: 'space-between',
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Message({ text }: { text: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.surface, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 14, color: c['text-2'] }} />
    </FlexWidget>
  );
}

/** A square tap target. `on` lights it up. */
function Chip({ label, on, size, action, uri }: { label: string; on?: boolean; size: number; action?: { name: string; data?: Record<string, unknown> }; uri?: string }) {
  return (
    <FlexWidget
      clickAction={uri ? 'OPEN_URI' : action?.name}
      clickActionData={uri ? { uri } : action?.data}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? c['accent-fill'] : c['surface-2'], justifyContent: 'center', alignItems: 'center' }}
    >
      <TextWidget text={label} style={{ fontSize: Math.round(size * 0.46), color: c['text-1'] }} />
    </FlexWidget>
  );
}

/** Weight or hours: a value in a pill, or an icon when there is none yet. */
function Pill({ label, size, action, uri }: { label: string; size: number; action?: { name: string }; uri?: string }) {
  return (
    <FlexWidget
      clickAction={uri ? 'OPEN_URI' : action?.name}
      clickActionData={uri ? { uri } : undefined}
      style={{ height: size, paddingHorizontal: 8, borderRadius: size / 2, backgroundColor: c['surface-2'], justifyContent: 'center', alignItems: 'center' }}
    >
      <TextWidget text={label} style={{ fontSize: 12, fontWeight: '600', color: c['text-1'] }} />
    </FlexWidget>
  );
}

const habitChips = (s: Snapshot, max: number, size: number) =>
  shownHabits(s.state?.habits ?? [], s.picked, max).map((h) => (
    <Chip key={h.id} label={h.icon ? GLYPHS[h.icon] : h.name.slice(0, 1).toUpperCase()} on={h.done} size={size} action={{ name: 'HABIT', data: { id: h.id } }} />
  ));

const weightLabel = (s: Snapshot) => (s.state?.weight != null ? String(s.state.weight) : '⚖');
const hoursLabel = (s: Snapshot) => {
  if (s.noUsualHours && !s.state?.hours) return 'Set usual';
  return s.state?.hours ? `${s.state.hours}h` : '⏱';
};

function early(s: Snapshot): React.JSX.Element | null {
  if (!s.conn) return <Message text="Tap to connect" />;
  if (s.keyBad) return <Message text="Key not valid" />;
  if (!s.state) return <Message text="Loading" />;
  return null;
}

function Ring({ s, size }: { s: Snapshot; size: number }) {
  const p = s.state?.progress ?? { filled: 0, total: 0 };
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `${s.conn?.url}/quick` }} style={{ width: size, height: size }}>
      <SvgWidget svg={ring(p.filled, p.total, size)} style={{ width: size, height: size }} />
    </FlexWidget>
  );
}

export function JournalLarge({ s }: { s: Snapshot }) {
  const stop = early(s);
  if (stop) return stop;
  const face = faceOf(s.state?.mood ?? null);
  return (
    <Shell>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {FACES.map((f, i) => (
          <Chip key={f.emoji} label={f.emoji} on={i === face} size={40} uri={`journalwidget://mood?face=${i}`} />
        ))}
        <Ring s={s} size={44} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {habitChips(s, 4, 36)}
        <Pill label={weightLabel(s)} size={36} uri="journalwidget://weight" />
        <Pill label={hoursLabel(s)} size={36} action={{ name: 'HOURS' }} />
      </FlexWidget>
    </Shell>
  );
}

export function JournalSmall({ s }: { s: Snapshot }) {
  const stop = early(s);
  if (stop) return stop;
  const face = faceOf(s.state?.mood ?? null);
  return (
    <Shell row>
      <Chip label={face >= 0 ? FACES[face].emoji : '🙂'} on={face >= 0} size={34} uri="journalwidget://mood" />
      {habitChips(s, 4, 34)}
      <Chip label="⚖" on={s.state?.weight != null} size={34} uri="journalwidget://weight" />
      <Chip label="⏱" on={(s.state?.hours ?? 0) >= 24} size={34} action={{ name: 'HOURS' }} />
      <Ring s={s} size={36} />
    </Shell>
  );
}
