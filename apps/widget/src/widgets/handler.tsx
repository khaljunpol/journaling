import React from 'react';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { record, refresh, snapshot, type Snapshot } from '../sync';
import type { Action } from '../logic/api';
import { JournalLarge, JournalSmall } from './JournalWidgets';

function view(name: string, s: Snapshot) {
  return name === 'JournalSmall' ? <JournalSmall s={s} /> : <JournalLarge s={s} />;
}

/** Repaints every placed widget, both sizes. */
export async function paintAll(s: Snapshot): Promise<void> {
  await Promise.all(['JournalLarge', 'JournalSmall'].map((widgetName) => requestWidgetUpdate({ widgetName, renderWidget: () => view(widgetName, s) })));
}

/** Save a tap: draw it at once, then reach the server and draw the truth. Also used by the popups. */
export async function tap(action: Action): Promise<void> {
  await paintAll(await record(action));
  await paintAll(await refresh());
}

function actionOf(props: WidgetTaskHandlerProps): Action | null {
  if (props.clickAction === 'HOURS') return { action: 'hours' };
  const id = props.clickActionData?.id;
  if (props.clickAction === 'HABIT' && typeof id === 'string') return { action: 'habit', activityId: id };
  return null;
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const name = props.widgetInfo.widgetName;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(view(name, await snapshot()));
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
