import type { QuickPayload } from '@journaling/core/quickPayload';
import type { TimeCategory } from '@/lib/types';

/** One write for the outbox. */
export type SaveSpec = { key: string; url: string; method: 'POST'; body: unknown };

export type QuestInfo = Record<string, { title: string; unit?: string }>;

export type EditorProps = {
  date: string;
  payload: QuickPayload;
  /** Body still waiting in the outbox for a key. Used to show what was typed. */
  queued: (key: string) => unknown;
  onSave: (specs: SaveSpec[]) => void;
  /** Button text; the card stack sets Next / Done. */
  submitLabel?: string;
};

export type HoursEditorProps = EditorProps & { categories: TimeCategory[] };
export type QuestsEditorProps = EditorProps & { quests: QuestInfo };
