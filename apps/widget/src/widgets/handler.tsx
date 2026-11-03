import React from 'react';
import { Vibration } from 'react-native';
import { requestWidgetUpdate, type WidgetInfo, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { nextLine, record, refresh, refreshClimb, refreshGame, refreshHistory, refreshInsights, refreshWeek, refreshWorld, snapshot, type Snapshot } from '../sync';
import type { Action } from '../logic/api';
import { readsAfterTap } from '../logic/reads';
import { Journal, JournalClimb, JournalInsight, JournalLevel, JournalMood, JournalOverview, JournalValley, JournalWeek, JournalWeight } from './JournalWidgets';

/** One short tick when a log is saved. */
const TICK_MS = 15;
const NAMES = ['JournalLarge', 'JournalSmall', 'JournalWeek', 'JournalMood', 'JournalWeight', 'JournalOverview', 'JournalInsight', 'JournalClimb', 'JournalValley', 'JournalLevel'];
/** The extra read each widget needs. Only those widgets pay for it. */
const READS: Record<string, (() => Promise<Snapshot>) | undefined> = { JournalWeek: refreshWeek, JournalMood: refreshHistory, JournalWeight: refreshHistory, JournalOverview: refreshInsights, JournalInsight: refreshInsights, JournalClimb: refreshClimb, JournalValley: refreshWorld, JournalLevel: refreshGame };

function view(info: WidgetInfo, s: Snapshot) {
  const props = { s, width: info.width, height: info.height };
  if (info.widgetName === 'JournalWeek') return <JournalWeek {...props} />;
  if (info.widgetName === 'JournalMood') return <JournalMood {...props} />;
  if (info.widgetName === 'JournalWeight') return <JournalWeight {...props} />;
  if (info.widgetName === 'JournalClimb') return <JournalClimb {...props} />;
  if (info.widgetName === 'JournalValley') return <JournalValley {...props} />;
  if (info.widgetName === 'JournalLevel') return <JournalLevel {...props} />;
  if (info.widgetName === 'JournalInsight') return <JournalInsight {...props} />;
  if (info.widgetName === 'JournalOverview') return <JournalOverview {...props} />;
  return <Journal {...props} />;
}

/** Repaints every placed widget. */
export async function paintAll(s: Snapshot): Promise<void> {
  await Promise.all(NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: (info) => view(info, s) })));
}

/** After a save, the level and valley widgets read again, but only if they are placed. */
async function afterSave(s: Snapshot): Promise<void> {
  await paintAll(s);
  const reads = readsAfterTap(s);
  if (!reads.length) return;
  let last = s;
  for (const r of reads) last = await (r === 'game' ? refreshGame() : refreshWorld());
  await paintAll(last);
}

/** Save a tap: draw it at once, then reach the server and draw the truth. Also used by the popups. */
export async function tap(action: Action): Promise<void> {
  Vibration.vibrate(TICK_MS);
  await paintAll(await record(action));
  await afterSave(await refresh());
}

/** For the popups: the save carries on after the popup has closed. */
export async function tapThenLeave(action: Action, leave: () => void): Promise<void> {
  Vibration.vibrate(TICK_MS);
  await paintAll(await record(action));
  leave();
  await afterSave(await refresh());
}

function actionOf(props: WidgetTaskHandlerProps): Action | null {
  const id = props.clickActionData?.id;
  if (props.clickAction === 'HABIT' && typeof id === 'string') return { action: 'habit', activityId: id, done: props.clickActionData?.done !== false };
  return null;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(view(props.widgetInfo, await snapshot()));
      await refresh();
      if (props.widgetAction === 'WIDGET_UPDATE' && props.widgetInfo.widgetName === 'JournalInsight') await nextLine();
      await paintAll(await (READS[props.widgetInfo.widgetName] ?? snapshot)());
      break;
    case 'WIDGET_CLICK': {
      if (props.clickAction === 'NEXT_LINE') {
        await paintAll(await nextLine());
        break;
      }
      const action = actionOf(props);
      if (action) await tap(action);
      break;
    }
    default:
      break;
  }
}
