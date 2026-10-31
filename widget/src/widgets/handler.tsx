import React from 'react';
import { FlexWidget, TextWidget, type WidgetTaskHandlerProps } from 'react-native-android-widget';

function Hello({ label }: { label: string }) {
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10131c', borderRadius: 16 }}>
      <TextWidget text={label} style={{ fontSize: 16, color: '#ffffff' }} />
    </FlexWidget>
  );
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  props.renderWidget(<Hello label={`Journal test · ${props.widgetInfo.widgetName}`} />);
}
