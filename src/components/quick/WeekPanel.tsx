'use client';

import { useState } from 'react';
import { CATCHUP_KINDS, toggleKind } from '@/lib/quickWeek';
import type { ItemKey } from '@/lib/quickDay';

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
  onSaveChoice: (choice: ItemKey[]) => void;
  onCatchUp: (choice: ItemKey[]) => void;
  onFillHours: () => void;
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
  onSaveChoice,
  onCatchUp,
  onFillHours,
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
    <section className="card space-y-3 p-3" aria-label="This week">
      {!isCurrent && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Week summary</p>
          <p className="text-sm muted">{summary ?? 'Loading the week…'}</p>
        </div>
      )}

      {!isCurrent && editing === null && loaded && (
        <div className="space-y-1">
          {stepsLeft > 0 ? (
            <button type="button" onClick={pressCatchUp} className="btn min-h-11 w-full font-semibold">
              Catch up this week ▶
            </button>
          ) : (
            <p className="text-center text-sm muted">Nothing left to catch up here. Nice.</p>
          )}
          {chosen && (
            <button type="button" onClick={() => openEditor('change')} className="min-h-11 w-full text-xs underline muted">
              Change what to catch up
            </button>
          )}
        </div>
      )}

      {!isCurrent && editing !== null && (
        <fieldset className="space-y-1">
          <legend className="text-sm">Which parts do you want to fill in?</legend>
          {CATCHUP_KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={draft.includes(k)}
                onChange={() => setDraft((d) => toggleKind(d, k))}
              />
              {NAMES[k]}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={confirm} disabled={draft.length === 0} className="btn min-h-11 flex-1 font-semibold">
              {editing === 'start' ? 'Start' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline min-h-11 flex-1">
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      <button type="button" onClick={onFillHours} className="btn-outline min-h-11 w-full" disabled={!loaded}>
        Fill empty hours from templates
      </button>
      {message && (
        <p className="text-center text-xs muted" role="status">
          {message}
        </p>
      )}

      {!isCurrent && (
        <button type="button" onClick={onToday} className="min-h-11 w-full text-sm underline">
          Back to today
        </button>
      )}
    </section>
  );
}
