'use client';

import { useState } from 'react';
import { CATCHUP_KINDS, toggleKind } from '@journaling/core/quickWeek';
import type { ItemKey } from '@journaling/core/quickDay';
import Button from '@/components/ui/Button';

const NAMES: Partial<Record<ItemKey, string>> = {
  mood: 'Mood',
  habits: 'Habits',
  weight: 'Weight',
  sidequests: 'Side quests',
  hours: 'Hours',
  highlight: 'Highlight',
};

type Props = {
  isCurrent: boolean;
  /** Past weeks only: "12 of 30 filled", or null while the week loads. */
  summary: string | null;
  choice: ItemKey[];
  /** True once the user has picked kinds before. */
  chosen: boolean;
  /** Cards left to catch up with the current choice. */
  stepsLeft: number;
  loaded: boolean;
  message: string | null;
  habitMessage: string | null;
  onSaveChoice: (choice: ItemKey[]) => void;
  onCatchUp: (choice: ItemKey[]) => void;
  onFillHours: () => void;
  onFillHabits: () => void;
  onToday: () => void;
};

export default function WeekPanel({
  isCurrent,
  summary,
  choice,
  chosen,
  stepsLeft,
  loaded,
  message,
  habitMessage,
  onSaveChoice,
  onCatchUp,
  onFillHours,
  onFillHabits,
  onToday,
}: Props) {
  // 'start' = first time, picking before the run. 'change' = editing later.
  const [editing, setEditing] = useState<null | 'start' | 'change'>(null);
  const [draft, setDraft] = useState<ItemKey[]>(choice);

  function openEditor(mode: 'start' | 'change') {
    setDraft(choice);
    setEditing(mode);
  }

  function pressCatchUp() {
    if (!chosen) openEditor('start');
    else onCatchUp(choice);
  }

  function confirm() {
    onSaveChoice(draft);
    const mode = editing;
    setEditing(null);
    if (mode === 'start') onCatchUp(draft);
  }

  return (
    <section className="space-y-3" aria-label="This week">
      {!isCurrent && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Week summary</p>
          <p className="num text-[13px]" style={{ color: 'var(--text-2)' }}>{summary ?? 'Loading the week…'}</p>
        </div>
      )}

      {!isCurrent && editing === null && loaded && (
        <div className="space-y-1">
          {stepsLeft > 0 ? (
            <Button variant="outline" onClick={pressCatchUp} className="w-full font-semibold">
              Catch up this week
            </Button>
          ) : (
            <p className="text-center text-[13px]" style={{ color: 'var(--text-2)' }}>Nothing left to catch up here. Nice.</p>
          )}
          {chosen && (
            <Button variant="ghost" small onClick={() => openEditor('change')} className="w-full">
              Change what to catch up
            </Button>
          )}
        </div>
      )}

      {!isCurrent && editing !== null && (
        <fieldset className="space-y-1">
          <legend className="text-[14px]" style={{ color: 'var(--text-1)' }}>Which parts do you want to fill in?</legend>
          {CATCHUP_KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 text-[14px]" style={{ color: 'var(--text-1)' }}>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent-fill)]"
                checked={draft.includes(k)}
                onChange={() => setDraft((d) => toggleKind(d, k))}
              />
              {NAMES[k]}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={confirm} disabled={draft.length === 0} className="flex-1 font-semibold">
              {editing === 'start' ? 'Start' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">
              Cancel
            </Button>
          </div>
        </fieldset>
      )}

      <Button variant="outline" onClick={onFillHours} className="w-full" disabled={!loaded}>
        Fill empty hours from templates
      </Button>
      {message && (
        <p className="text-center text-[13px]" style={{ color: 'var(--text-2)' }} role="status">
          {message}
        </p>
      )}
      <Button variant="outline" onClick={onFillHabits} className="w-full" disabled={!loaded}>
        Fill empty habits from usual lists
      </Button>
      {habitMessage && (
        <p className="text-center text-[13px]" style={{ color: 'var(--text-2)' }} role="status">
          {habitMessage}
        </p>
      )}

      {!isCurrent && (
        <Button variant="ghost" onClick={onToday} className="w-full">
          Back to today
        </Button>
      )}
    </section>
  );
}
