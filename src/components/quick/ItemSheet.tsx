'use client';

import Sheet from '@/components/ui/Sheet';
import type { ItemKey } from '@/lib/quickDay';
import type { QuickPayload } from '@/lib/quickPayload';
import type { TimeCategory } from '@/lib/types';
import MoodEditor from './editors/MoodEditor';
import HabitsEditor from './editors/HabitsEditor';
import WeightEditor from './editors/WeightEditor';
import HighlightEditor from './editors/HighlightEditor';
import QuestsEditor from './editors/QuestsEditor';
import HoursEditor from './editors/HoursEditor';
import type { QuestInfo, SaveSpec } from './editors/types';

export type SheetTarget = { date: string; key: ItemKey };

export const TITLES: Record<ItemKey, string> = {
  mood: 'How was the day?',
  habits: 'Habits',
  weight: 'Weight',
  sidequests: 'Side quests',
  hours: 'Hours',
  highlight: 'Highlight',
  climb: 'Climbing',
};

type Props = {
  target: SheetTarget;
  dayLabel: string;
  payload: QuickPayload;
  categories: TimeCategory[];
  quests: QuestInfo;
  queued: (key: string) => unknown;
  onSave: (specs: SaveSpec[]) => void;
  onClose: () => void;
};

export default function ItemSheet({ target, dayLabel, payload, categories, quests, queued, onSave, onClose }: Props) {
  const { date, key } = target;
  const common = { date, payload, queued, onSave };

  // The kit Sheet gives focus trap, Escape, Back button, z-50 above the tabs and the motion.
  return (
    <Sheet open onClose={onClose} title={TITLES[key]} subtitle={dayLabel}>
      {key === 'mood' && <MoodEditor {...common} />}
      {key === 'habits' && <HabitsEditor {...common} />}
      {key === 'weight' && <WeightEditor {...common} />}
      {key === 'highlight' && <HighlightEditor {...common} />}
      {key === 'sidequests' && <QuestsEditor {...common} quests={quests} />}
      {key === 'hours' && <HoursEditor {...common} categories={categories} />}
    </Sheet>
  );
}
