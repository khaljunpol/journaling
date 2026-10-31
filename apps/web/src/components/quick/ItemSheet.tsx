'use client';

import Sheet from '@/components/ui/Sheet';
import Button from '@/components/ui/Button';
import type { ItemKey } from '@/lib/quickDay';
import type { QuickPayload } from '@/lib/quickPayload';
import type { TimeCategory } from '@/lib/types';
import MoodEditor from './editors/MoodEditor';
import HabitsEditor from './editors/HabitsEditor';
import WeightEditor from './editors/WeightEditor';
import HighlightEditor from './editors/HighlightEditor';
import QuestsEditor from './editors/QuestsEditor';
import HoursEditor from './editors/HoursEditor';
import DayPill from './DayPill';
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
  today: string | null;
  yesterday: string | null;
  payload: QuickPayload;
  categories: TimeCategory[];
  quests: QuestInfo;
  queued: (key: string) => unknown;
  onSave: (specs: SaveSpec[]) => void;
  onClose: () => void;
  /** Queue items for this tile that the server refused. */
  failedKeys?: string[];
  onDiscard?: (keys: string[]) => void;
};

export default function ItemSheet({ target, today, yesterday, payload, categories, quests, queued, onSave, onClose, failedKeys = [], onDiscard }: Props) {
  const { date, key } = target;
  const common = { date, payload, queued, onSave };

  // The kit Sheet gives focus trap, Escape, Back button, z-50 above the tabs and the motion.
  return (
    <Sheet open onClose={onClose} title={TITLES[key]}>
      <div className="mb-4"><DayPill date={date} today={today} yesterday={yesterday} /></div>
      {failedKeys.length > 0 && onDiscard && (
        <div className="mb-4 flex items-center gap-3 rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--warn)' }} role="alert">
          <p className="min-w-0 flex-1 text-[13px]" style={{ color: 'var(--text-1)' }}>This didn&apos;t save. Save again, or discard it.</p>
          <Button variant="ghost" small onClick={() => onDiscard(failedKeys)}>Discard</Button>
        </div>
      )}
      {key === 'mood' && <MoodEditor {...common} />}
      {key === 'habits' && <HabitsEditor {...common} />}
      {key === 'weight' && <WeightEditor {...common} />}
      {key === 'highlight' && <HighlightEditor {...common} />}
      {key === 'sidequests' && <QuestsEditor {...common} quests={quests} />}
      {key === 'hours' && <HoursEditor {...common} categories={categories} />}
    </Sheet>
  );
}
