'use client';

import { useEffect, useRef } from 'react';
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

const TITLES: Record<ItemKey, string> = {
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { date, key } = target;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // Move focus into the sheet unless an editor already took it (autoFocus).
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus();
  }, []);

  const common = { date, payload, queued, onSave };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="quick-backdrop absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${TITLES[key]}, ${dayLabel}`}
        tabIndex={-1}
        className="quick-sheet relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t px-4 pb-6 pt-3 outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{TITLES[key]}</h2>
            <p className="subtle">{dayLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-outline min-h-11 min-w-11 rounded-full">
            ✕
          </button>
        </div>
        {key === 'mood' && <MoodEditor {...common} />}
        {key === 'habits' && <HabitsEditor {...common} />}
        {key === 'weight' && <WeightEditor {...common} />}
        {key === 'highlight' && <HighlightEditor {...common} />}
        {key === 'sidequests' && <QuestsEditor {...common} quests={quests} />}
        {key === 'hours' && <HoursEditor {...common} categories={categories} />}
      </div>
    </div>
  );
}
