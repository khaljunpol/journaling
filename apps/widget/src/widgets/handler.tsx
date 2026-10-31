import React from 'react';
import { requestWidgetUpdate, type WidgetInfo, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { record, refresh, refreshHistory, refreshInsights, refreshWeek, snapshot, type Snapshot } from '../sync';
import type { Action } from '../logic/api';
import { Journal, JournalMood, JournalOverview, JournalWeek, JournalWeight } from './JournalWidgets';

const NAMES = ['JournalLarge', 'JournalSmall', 'JournalWeek', 'JournalMood', 'JournalWeight', 'JournalOverview'];
/** The extra read each widget needs. Only those widgets pay for it. */
const READS: Record<string, (() => Promise<Snapshot>) | undefined> = { JournalWeek: refreshWeek, JournalMood: refreshHistory, JournalWeight: refreshHistory, JournalOverview: refreshInsights };

function view(info: WidgetInfo, s: Snapshot) {
  const props = { s, width: info.width, height: info.height };
  if (info.widgetName === 'JournalWeek') return <JournalWeek {...props} />;
  if (info.widgetName === 'JournalMood') return <JournalMood {...props} />;
  if (info.widgetName === 'JournalWeight') return <JournalWeight {...props} />;
  if (info.widgetName === 'JournalOverview') return <JournalOverview {...props} />;
  return <Journal {...props} />;
}

/** Repaints every placed widget. */
export async function paintAll(s: Snapshot): Promise<void> {
  await Promise.all(NAMES.map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: (info) => view(info, s) })));
}

/** Save a tap: draw it at once, then reach the server and draw the truth. Also used by the popups. */
export async function tap(action: Action): Promise<void> {
  await paintAll(await record(action));
  await paintAll(await refresh());
}

/** For the popups: the save carries on after the popup has closed. */
export async function tapThenLeave(action: Action, leave: () => void): Promise<void> {
  await paintAll(await record(action));
  leave();
  await paintAll(await refresh());
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
      await paintAll(await (READS[props.widgetInfo.widgetName] ?? snapshot)());
      break;
    case 'WIDGET_CLICK': {
      const action = actionOf(props);
      if (action) await tap(action);
      break;
    }
    default:
      break;
  }
}
