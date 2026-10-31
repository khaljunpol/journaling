import React from 'react';
import { requestWidgetUpdate, type WidgetInfo, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { record, refresh, snapshot, type Snapshot } from '../sync';
import type { Action } from '../logic/api';
import { JournalLarge, JournalSmall } from './JournalWidgets';

function view(info: WidgetInfo, s: Snapshot) {
  const Widget = info.widgetName === 'JournalSmall' ? JournalSmall : JournalLarge;
  return <Widget s={s} width={info.width} height={info.height} />;
}

/** Repaints every placed widget, both sizes. */
export async function paintAll(s: Snapshot): Promise<void> {
  await Promise.all(['JournalLarge', 'JournalSmall'].map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: (info) => view(info, s) })));
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
  if (props.clickAction === 'HOURS') return { action: 'hours' };
  const id = props.clickActionData?.id;
  if (props.clickAction === 'HABIT' && typeof id === 'string') return { action: 'habit', activityId: id };
  return null;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(view(props.widgetInfo, await snapshot()));
      await paintAll(await refresh());
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
