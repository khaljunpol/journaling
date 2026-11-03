// The home-screen widget: floating capsules of round lights. Off is dark, done is violet, ember only on a closed ring.
import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import { moodColor } from '@journaling/core/mood';
import { dark } from '@journaling/design';
import { shownHabits, shownHistory, shownLine, shownWeek, sparkPoints } from '../logic/queue';
import type { Snapshot } from '../sync';
import { iconSvg, type IconName } from './icons';
import { valleyLine, valleySvg } from '../logic/valley';
import { levelShare } from '../logic/level';

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

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Seven rings, Monday first. Today sits on a lighter disc, later days have only a faint letter. Blue was logged late, red is missing. One picture, one tap target. */
function weekSvg(s: Snapshot, w: number, size: number): string {
  const today = s.state?.date ?? '';
  const cell = w / 7;
  const r = size / 2 - 3;
  const len = 2 * Math.PI * r;
  const font = Math.round(size * 0.3);
  const parts = shownWeek(s.week, s.state as NonNullable<Snapshot['state']>).map((d, i) => {
    const x = cell * i + cell / 2;
    const y = size / 2;
    const later = d.date > today;
    const closed = d.total > 0 && d.filled >= d.total;
    const share = d.total > 0 ? Math.min(1, d.filled / d.total) : 0;
    const disc = d.date === today ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark['surface-2']}"/>` : '';
    const track = later ? '' : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${d.state === 'missed' ? dark.warn : dark['surface-3']}" stroke-width="3"/>`;
    const arc = share > 0
      ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${d.state === 'late' ? dark.sync : closed ? dark.reward : dark.accent}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${len * share} ${len}" transform="rotate(-90 ${x} ${y})"/>`
      : '';
    const ink = d.date === today ? dark['text-1'] : dark['text-2'];
    const letter = `<text x="${x}" y="${y + font * 0.36}" font-family="sans-serif" font-size="${font}" font-weight="600" text-anchor="middle" fill="${ink}"${later ? ' opacity="0.5"' : ''}>${LETTERS[i]}</text>`;
    return disc + track + arc + letter;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size}" viewBox="0 0 ${w} ${size}">${parts.join('')}</svg>`;
}

function Week({ s, width, height }: Size) {
  const w = Math.min(width, 420);
  const inner = w - INSET * 2;
  const size = Math.max(28, Math.min(44, Math.floor(inner / 7) - 4, height - 12));
  return (
    <Centre>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `${s.conn?.url}/quick` }} style={{ width: w, height: size + 12 }}>
        <Capsule w={w} h={size + 12}>
          <SvgWidget svg={weekSvg(s, inner, size)} style={{ width: inner, height: size }} />
        </Capsule>
      </FlexWidget>
    </Centre>
  );
}

const GAP = 8;
const PILL = 72;

/** A value pill and a picture side by side. The whole capsule opens the same window. */
function ValueStrip({ width, height, icon, value, uri, svg }: { width: number; height: number; icon: IconName; value?: string; uri: string; svg: (w: number, h: number) => string }) {
  const w = Math.min(width, 420);
  const size = Math.max(36, Math.min(48, height - 12));
  const chart = w - INSET * 2 - PILL - GAP * 2;
  return (
    <Centre>
      <FlexWidget {...clickOf({ uri })} style={{ width: w, height: size + 12 }}>
        <Capsule w={w} h={size + 12}>
          <Value w={PILL} h={size} icon={icon} value={value} fontSize={15} uri={uri} />
          <FlexWidget style={{ marginLeft: GAP }}>
            <SvgWidget svg={svg(chart, size)} style={{ width: chart, height: size }} />
          </FlexWidget>
        </Capsule>
      </FlexWidget>
    </Centre>
  );
}

/** 30 thin bars, one per day, in the app's mood colours. A day with no mood is a dark bar. */
function moodSvg(moods: Array<number | null>, w: number, h: number): string {
  const step = w / moods.length;
  const bar = Math.max(2, step - 2);
  const bars = moods.map((m, i) =>
    `<rect x="${step * i + (step - bar) / 2}" y="${h * 0.2}" width="${bar}" height="${h * 0.6}" rx="${bar / 2}" fill="${m === null ? dark['surface-3'] : moodColor(m)}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bars.join('')}</svg>`;
}

/** The weight trend as one line, with a dot on the latest value. */
function weightSvg(weights: Array<number | null>, w: number, h: number): string {
  const pad = 5;
  const pts = sparkPoints(weights, w - pad * 2, h - pad * 2).map((p) => ({ x: p.x + pad, y: p.y + pad }));
  const end = pts[pts.length - 1];
  const line = pts.length > 1
    ? `<polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${dark.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const dot = end ? `<circle cx="${end.x}" cy="${end.y}" r="3.5" fill="${dark.accent}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${line}${dot}</svg>`;
}

const stateOf = (s: Snapshot) => s.state as NonNullable<Snapshot['state']>;

/** What every widget shows until it has a day to draw. Null when it's ready. */
function notReady(s: Snapshot, width: number) {
  const w = Math.min(width, 280);
  if (!s.conn) return <Message text="Tap to connect" w={w} />;
  if (s.keyBad) return <Message text="Key not valid" warn w={w} />;
  if (!s.state) return <Message text="Loading" w={w} />;
  return null;
}

/** Both log widgets share this: the height decides the layout, so a resized widget always fits. */
export function Journal({ s, width, height }: Size) {
  return notReady(s, width) ?? (height < 110 ? <OneRow s={s} width={width} /> : <TwoRows s={s} width={width} />);
}

/** The week widget: how full each day was. Tap to open Journal. */
export function JournalWeek({ s, width, height }: Size) {
  return notReady(s, width) ?? <Week s={s} width={width} height={height} />;
}

/** The mood widget: the last 30 days. Tap to log today's mood. */
export function JournalMood({ s, width, height }: Size) {
  const mood = s.state?.mood;
  return notReady(s, width) ?? (
    <ValueStrip width={width} height={height} icon="smile" value={mood == null ? undefined : String(mood)} uri="journalwidget://mood"
      svg={(w, h) => moodSvg(shownHistory(s.history, stateOf(s)).map((d) => d.mood), w, h)} />
  );
}

/** The weight widget: the last known weight and its 30-day trend. Tap to log today's weight. */
export function JournalWeight({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const weights = shownHistory(s.history, stateOf(s)).map((d) => d.weight);
  const latest = weights.filter((v) => v !== null).pop();
  return <ValueStrip width={width} height={height} icon="scale" value={weightText(latest)} uri="journalwidget://weight" svg={(w, h) => weightSvg(weights, w, h)} />;
}

/** One answer: what it is, the number, and a small note. */
function Tile({ w, h, gap = 0, label, value, note, small }: { w: number; h: number; gap?: number; label: string; value: string; note?: string; small?: boolean }) {
  return (
    <FlexWidget style={{ width: w, height: h, marginLeft: gap, borderRadius: small ? 16 : 20, backgroundColor: c['surface-2'], paddingHorizontal: small ? 10 : 14, justifyContent: 'center' }}>
      <TextWidget text={label} maxLines={1} style={{ fontSize: small ? 11 : 12, color: c['text-2'] }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget text={value} style={{ fontSize: small ? 15 : 20, fontWeight: '600', color: c['text-1'] }} />
        {note ? <TextWidget text={note} maxLines={1} style={{ marginLeft: small ? 4 : 6, fontSize: small ? 11 : 12, color: c['text-2'] }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `\u2212${Math.abs(d)}` : undefined);

/** The home widget: the same answers as the Home page. Tap to open it. */
export function JournalOverview({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const w = Math.min(width, 420);
  const gap = 8;
  const tileW = Math.floor((w - INSET * 2 - gap) / 2);
  const tileH = Math.max(52, Math.min(68, Math.floor((height - INSET * 2 - gap) / 2)));
  const i = s.insights;
  const none = '\u2013';
  const delta = i?.mood.delta == null ? undefined : signed(i.mood.delta);
  const streak = i?.habits.streak ?? 0;
  if (height < 110) {
    const h = Math.max(44, Math.min(58, height));
    const small = Math.floor((w - INSET * 2 - 4 * 3) / 4);
    const tile = { w: small, h: h - 12, small: true };
    return (
      <Centre>
        <FlexWidget {...clickOf({ uri: `${s.conn?.url}/` })} style={{ width: w, height: h }}>
          <Capsule w={w} h={h}>
            <Tile {...tile} label="Mood" value={i?.mood.avg == null ? none : String(i.mood.avg)} note={delta} />
            <Tile {...tile} gap={4} label="Sleep" value={i?.sleep == null ? none : `${i.sleep}h`} />
            <Tile {...tile} gap={4} label="Habits" value={i?.habits.rate == null ? none : `${i.habits.rate}%`} note={streak >= 2 ? `${streak}d` : undefined} />
            <Tile {...tile} gap={4} label={i?.time?.name ?? 'Time'} value={i?.time ? `${i.time.hours}h` : none} />
          </Capsule>
        </FlexWidget>
      </Centre>
    );
  }
  return (
    <Centre>
      <FlexWidget {...clickOf({ uri: `${s.conn?.url}/` })} style={{ width: w, height: tileH * 2 + gap + INSET * 2, borderRadius: 28, backgroundColor: c.surface, padding: INSET }}>
        <FlexWidget style={{ flexDirection: 'row' }}>
          <Tile w={tileW} h={tileH} label="Mood this week" value={i?.mood.avg == null ? none : String(i.mood.avg)} note={delta} />
          <Tile w={tileW} h={tileH} gap={gap} label="Sleep a night" value={i?.sleep == null ? none : `${i.sleep}h`} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', marginTop: gap }}>
          <Tile w={tileW} h={tileH} label="Habits, 14 days" value={i?.habits.rate == null ? none : `${i.habits.rate}%`} note={streak >= 2 ? `${streak} days` : undefined} />
          <Tile w={tileW} h={tileH} gap={gap} label={i?.time ? `Most time: ${i.time.name}` : 'Most time'} value={i?.time ? `${i.time.hours}h` : none} />
        </FlexWidget>
      </FlexWidget>
    </Centre>
  );
}

/** The insight widget: one sentence to read. Green is good news, red is bad. Tap for the next one. */
export function JournalInsight({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const w = Math.min(width, 420);
  const h = Math.max(44, Math.min(64, height));
  const missed = s.insights?.yesterdayMissed === true;
  const line = missed ? { text: 'Yesterday is missed. Tap to log it.', tone: 'bad' } : shownLine(s.insights?.lines, s.lineAt);
  const dot = line?.tone === 'good' ? c.ok : line?.tone === 'bad' ? c.warn : c['text-3'];
  const press = missed ? clickOf({ uri: `${s.conn?.url}/quick` }) : { clickAction: 'NEXT_LINE' };
  return (
    <Centre>
      <FlexWidget {...press} style={{ width: w, height: h }}>
        <FlexWidget style={{ width: w, height: h, borderRadius: ROUND, backgroundColor: c.surface, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
          <TextWidget text={line?.text ?? 'Keep logging. Insights show up here.'} maxLines={2} style={{ marginLeft: 12, fontSize: 15, fontWeight: '600', color: line ? c['text-1'] : c['text-2'] }} />
        </FlexWidget>
      </FlexWidget>
    </Centre>
  );
}

const ago = (days: number | null | undefined) => (days == null ? '\u2013' : days === 0 ? 'Today' : `${days}d`);

/** The climb widget: this week, the last climb, the hardest send this year, and the run of weeks. Tap to open climbing. */
export function JournalClimb({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const w = Math.min(width, 420);
  const h = Math.max(44, Math.min(58, height));
  const small = Math.floor((w - INSET * 2 - 4 * 3) / 4);
  const tile = { w: small, h: h - 12, small: true };
  const k = s.climb;
  const none = '\u2013';
  return (
    <Centre>
      <FlexWidget {...clickOf({ uri: `${s.conn?.url}/climbing` })} style={{ width: w, height: h }}>
        <Capsule w={w} h={h}>
          <Tile {...tile} label="This week" value={k ? String(k.sessions) : none} />
          <Tile {...tile} gap={4} label="Last climb" value={ago(k?.daysSince)} />
          <Tile {...tile} gap={4} label="Hardest" value={k?.hardest ?? none} />
          <Tile {...tile} gap={4} label="Weeks" value={k ? String(k.weeks) : none} />
        </Capsule>
      </FlexWidget>
    </Centre>
  );
}

/** The valley widget: a still picture of the valley and one line. Tap to open it. */
export function JournalValley({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const w = Math.min(width, 420);
  const h = Math.max(100, Math.min(220, height));
  // The picture fills the whole widget; the line sits on its darker bottom edge.
  return (
    <Centre>
      <OverlapWidget {...clickOf({ uri: `${s.conn?.url}/world` })} style={{ width: w, height: h, borderRadius: 28, overflow: 'hidden', backgroundColor: c.surface }}>
        {s.world ? <SvgWidget svg={valleySvg(s.world, w, h)} style={{ width: w, height: h }} /> : <FlexWidget style={{ width: w, height: h, backgroundColor: c['surface-2'] }} />}
        <FlexWidget style={{ width: w, height: h, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 12 }}>
          <TextWidget text={s.world ? valleyLine(s.world) : 'Loading your valley'} maxLines={1} style={{ fontSize: 14, fontWeight: '600', color: s.world ? c['text-1'] : c['text-2'] }} />
        </FlexWidget>
      </OverlapWidget>
    </Centre>
  );
}

/** A thin bar to the next level, ember like the level chip. */
function levelBarSvg(share: number, w: number): string {
  const h = 6;
  const fill = Math.max(h, Math.round(w * Math.min(1, Math.max(0, share))));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<rect width="${w}" height="${h}" rx="3" fill="${dark['surface-3']}"/><rect width="${fill}" height="${h}" rx="3" fill="${dark.reward}"/></svg>`;
}

/** The level widget: level and the way to the next, the best streak, and perfect days. Tap to open You. */
export function JournalLevel({ s, width, height }: Size) {
  const ready = notReady(s, width);
  if (ready) return ready;
  const w = Math.min(width, 420);
  const h = Math.max(44, Math.min(58, height));
  const g = s.game;
  const none = '–';
  const third = Math.floor((w - INSET * 2 - 4 * 2) / 3);
  const tile = { w: third, h: h - 12, small: true };
  const streak = g?.topStreak ? `${g.topStreak.days}${g.topStreak.unit === 'weeks' ? 'w' : 'd'}` : none;
  const share = g ? levelShare(g) : 0;
  return (
    <Centre>
      <FlexWidget {...clickOf({ uri: `${s.conn?.url}/you` })} style={{ width: w, height: h }}>
        <Capsule w={w} h={h}>
          <FlexWidget style={{ width: third, height: h - 12, borderRadius: 16, backgroundColor: c['surface-2'], paddingHorizontal: 10, justifyContent: 'center' }}>
            <TextWidget text={g ? `Level ${g.level}` : 'Level'} maxLines={1} style={{ fontSize: 13, fontWeight: '600', color: c['reward-text'] }} />
            <FlexWidget style={{ marginTop: 4 }}>
              <SvgWidget svg={levelBarSvg(share, third - 20)} style={{ width: third - 20, height: 6 }} />
            </FlexWidget>
          </FlexWidget>
          <Tile {...tile} gap={4} label={g?.topStreak?.name ?? 'Streak'} value={streak} />
          <Tile {...tile} gap={4} label="Perfect days" value={g ? String(g.perfectDays) : none} />
        </Capsule>
      </FlexWidget>
    </Centre>
  );
}
