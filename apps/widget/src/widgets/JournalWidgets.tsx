// The home-screen widget: floating capsules of round lights. Off is dark, done is violet, ember only on a closed ring.
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { dark } from '@journaling/design';
import { shownHabits } from '../logic/queue';
import type { Snapshot } from '../sync';
import { iconSvg, type IconName } from './icons';

const c = dark as unknown as Record<keyof typeof dark, ColorProp>;
const INSET = 6;
const ROUND = 999;

type Press = { action?: { name: string; data?: Record<string, unknown> }; uri?: string };
const clickOf = ({ action, uri }: Press) =>
  uri ? { clickAction: 'OPEN_URI', clickActionData: { uri } } : { clickAction: action?.name, clickActionData: action?.data };

const Icon = ({ name, color, size }: { name: IconName; color: string; size: number }) => (
  <SvgWidget svg={iconSvg(name, color, size)} style={{ width: size, height: size }} />
);

/** A value (mood, weight, hours): always its icon plus the number, so each one says what it is. Never violet: only habits light up. */
function Value({ w, h, icon, value, gap = 0, stack, fontSize, ...press }: Press & { w: number; h: number; icon: IconName; value?: string; gap?: number; stack?: boolean; fontSize?: number }) {
  const set = value !== undefined;
  return (
    <FlexWidget
      {...clickOf(press)}
      style={{ width: w, height: h, marginLeft: gap, borderRadius: ROUND, backgroundColor: c['surface-2'], flexDirection: stack && set ? 'column' : 'row', justifyContent: 'center', alignItems: 'center' }}
    >
      <Icon name={icon} color={set ? dark.accent : dark['text-2']} size={set ? (stack ? 12 : 16) : Math.round(Math.min(w, h) * 0.5)} />
      {set && <TextWidget text={value} style={{ marginLeft: stack ? 0 : 6, fontSize: fontSize ?? 13, fontWeight: '600', color: c['text-1'] }} />}
    </FlexWidget>
  );
}

/** A round light, or a pill when wider than tall. Holds an icon or a value. `gap` is the space before it. */
function Light({ w, h, on, icon, value, gap = 0, fontSize, ...press }: Press & { w: number; h: number; on?: boolean; icon?: IconName; value?: string; gap?: number; fontSize?: number }) {
  const ink = on ? dark['on-accent-fill'] : dark['text-2'];
  const iconSize = Math.round(Math.min(w, h) * 0.5);
  return (
    <FlexWidget
      {...clickOf(press)}
      style={{ width: w, height: h, marginLeft: gap, borderRadius: ROUND, backgroundColor: on ? c['accent-fill'] : c['surface-2'], flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
    >
      {icon && <Icon name={icon} color={ink} size={value ? 16 : iconSize} />}
      {value && (
        <TextWidget
          text={value}
          style={{ marginLeft: icon ? 6 : 0, fontSize: fontSize ?? 13, fontWeight: '600', color: on ? c['on-accent-fill'] : c['text-1'] }}
        />
      )}
    </FlexWidget>
  );
}

function ringSvg(filled: number, total: number, size: number, font: number): string {
  const r = 15.5;
  const len = 2 * Math.PI * r;
  const closed = total > 0 && filled >= total;
  const share = total > 0 ? Math.min(1, filled / total) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${dark['surface-3']}" stroke-width="3"/>
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="${closed ? dark.reward : dark.accent}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${len * share} ${len}" transform="rotate(-90 18 18)"/>
    <text x="18" y="${18 + font * 0.36}" font-family="sans-serif" font-size="${font}" font-weight="600" text-anchor="middle" fill="${dark['text-1']}">${filled}/${total}</text>
  </svg>`;
}

function Ring({ s, size, gap = 0 }: { s: Snapshot; size: number; gap?: number }) {
  const p = s.state?.progress ?? { filled: 0, total: 0 };
  return (
    <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `${s.conn?.url}/quick` }} style={{ width: size, height: size, marginLeft: gap }}>
      <SvgWidget svg={ringSvg(p.filled, p.total, size, 10.5)} style={{ width: size, height: size }} />
    </FlexWidget>
  );
}

function Capsule({ w, h, children, spread }: { w: number; h: number; children: React.ReactNode; spread?: boolean }) {
  return (
    <FlexWidget style={{ width: w, height: h, borderRadius: ROUND, backgroundColor: c.surface, paddingHorizontal: INSET, flexDirection: 'row', alignItems: 'center', justifyContent: spread ? 'space-between' : 'flex-start' }}>
      {children}
    </FlexWidget>
  );
}

function Centre({ children, click }: { children: React.ReactNode; click?: boolean }) {
  return (
    <FlexWidget clickAction={click ? 'OPEN_APP' : undefined} style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </FlexWidget>
  );
}

function Message({ text, warn, w }: { text: string; warn?: boolean; w: number }) {
  return (
    <Centre click>
      <FlexWidget style={{ width: w, height: 48, borderRadius: ROUND, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text={text} style={{ fontSize: 13, color: warn ? c.warn : c['text-2'] }} />
      </FlexWidget>
    </Centre>
  );
}

const habitLights = (s: Snapshot, max: number, size: number, gapOf: (i: number) => number) =>
  shownHabits(s.state?.habits ?? [], s.picked, max).map((h, i) =>
    h.icon ? (
      <Light key={h.id} w={size} h={size} gap={gapOf(i)} on={h.done} icon={h.icon} action={{ name: 'HABIT', data: { id: h.id, done: !h.done } }} />
    ) : (
      <Light key={h.id} w={size} h={size} gap={gapOf(i)} on={h.done} value={h.name.slice(0, 1).toUpperCase()} action={{ name: 'HABIT', data: { id: h.id, done: !h.done } }} />
    ));

const weightText = (w: number | null | undefined) => (w == null ? undefined : w >= 100 ? String(Math.round(w)) : String(w));
const hoursText = (s: Snapshot) => (s.state?.hours ? `${s.state.hours}h` : s.noUsualHours ? 'Set' : undefined);

type Size = { s: Snapshot; width: number; height: number };

/** One capsule: mood, weight, hours, then habits, then More and the ring. Everything, just smaller. */
function OneRow({ s, width }: { s: Snapshot; width: number }) {
  const w = Math.min(width, 420);
  const count = shownHabits(s.state?.habits ?? [], s.picked, 4).length;
  const GAP = 3;
  const GROUP = 7;
  const size = Math.max(30, Math.min(44, Math.floor((w - INSET * 2 - GROUP * 2 - GAP * 6) / 9)));
  // Fewer habits: the spare width goes to the three values.
  const spare = (4 - count) * (size + GAP);
  const pill = Math.min(64, size + Math.floor(spare / 3));
  const mood = s.state?.mood;
  const weight = weightText(s.state?.weight);
  const hours = hoursText(s);
  const font = size < 34 ? 11 : 12;
  return (
    <Centre>
      <Capsule w={w} h={Math.min(size + 12, 56)} spread>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Value w={pill} h={size} stack icon="smile" value={mood == null ? undefined : String(mood)} fontSize={font} uri="journalwidget://mood" />
          <Value w={pill} h={size} gap={GAP} stack icon="scale" value={weight} fontSize={font} uri="journalwidget://weight" />
          <Value w={pill} h={size} gap={GAP} stack icon="clock" value={hours} fontSize={font} uri="journalwidget://hours" />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          {habitLights(s, 4, size, (i) => (i ? GAP : 0))}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Light w={size} h={size} icon="more" uri="journalwidget://more" />
          <Ring s={s} size={size} gap={GAP} />
        </FlexWidget>
      </Capsule>
    </Centre>
  );
}

/** Two capsules: values, More and the ring on top, habits below. */
function TwoRows({ s, width }: { s: Snapshot; width: number }) {
  const w = Math.min(width, 420);
  const H = 60;
  const T = 48;
  const inner = w - INSET * 2;
  const pill = Math.floor((inner - T * 2 - 4 * 3 - 6) / 3);
  const mood = s.state?.mood;
  const weight = weightText(s.state?.weight);
  const hours = hoursText(s);
  const count = shownHabits(s.state?.habits ?? [], s.picked, 6).length;
  const circle = Math.min(48, Math.floor((inner - 4 * 5) / 6));
  return (
    <Centre>
      <Capsule w={w} h={H}>
        <Value w={pill} h={T} icon="smile" value={mood == null ? undefined : String(mood)} fontSize={18} uri="journalwidget://mood" />
        <Value w={pill} h={T} gap={4} icon="scale" value={weight} fontSize={weight && weight.length > 3 ? 15 : 18} uri="journalwidget://weight" />
        <Value w={pill} h={T} gap={4} icon="clock" value={hours} fontSize={15} uri="journalwidget://hours" />
        <Light w={T} h={T} gap={4} icon="more" uri="journalwidget://more" />
        <Ring s={s} size={T} gap={6} />
      </Capsule>
      {count > 0 && (
        <FlexWidget style={{ marginTop: 8 }}>
          <Capsule w={w} h={H} spread>{habitLights(s, 6, circle, () => 0)}</Capsule>
        </FlexWidget>
      )}
    </Centre>
  );
}

/** Both widget types share this: the height decides the layout, so a resized widget always fits. */
export function Journal({ s, width, height }: Size) {
  if (!s.conn) return <Message text="Tap to connect" w={Math.min(width, 280)} />;
  if (s.keyBad) return <Message text="Key not valid" warn w={Math.min(width, 280)} />;
  if (!s.state) return <Message text="Loading" w={Math.min(width, 280)} />;
  return height < 110 ? <OneRow s={s} width={width} /> : <TwoRows s={s} width={width} />;
}
