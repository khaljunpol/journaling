'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dayStatus, type ItemKey } from '@/lib/quickDay';
import { SLIDE_MS, canAdvance, cardsLeft, dotState, nextStep } from '@/lib/cardStack';
import type { QuickPayload } from '@/lib/quickPayload';
import type { TimeCategory } from '@/lib/types';
import { TITLES } from './ItemSheet';
import MoodEditor from './editors/MoodEditor';
import HabitsEditor from './editors/HabitsEditor';
import WeightEditor from './editors/WeightEditor';
import HighlightEditor from './editors/HighlightEditor';
import QuestsEditor from './editors/QuestsEditor';
import HoursEditor from './editors/HoursEditor';
import type { QuestInfo, SaveSpec } from './editors/types';

type Props = {
  date: string;
  dayLabel: string;
  /** Captured when the stack opened. */
  cards: ItemKey[];
  payload: QuickPayload;
  categories: TimeCategory[];
  quests: QuestInfo;
  queued: (key: string) => unknown;
  onSave: (specs: SaveSpec[]) => void;
  onClose: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function CardStack({ date, dayLabel, cards, payload, categories, quests, queued, onSave, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lockedUntil = useRef(0);
  const closedRef = useRef(false);
  const [sliding, setSliding] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const total = cards.length;
  const finished = index >= total;
  const day = payload.days[date];
  let complete = false;
  if (day) {
    const s = dayStatus(day, payload.ctx);
    complete = s.filled === s.total;
  }

  // One history entry, so the phone's back button closes the stack and not the page.
  useEffect(() => {
    if (!(window.history.state && window.history.state.quickStack)) {
      window.history.pushState({ ...(window.history.state ?? {}), quickStack: true }, '');
    }
    const onPop = () => onCloseRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (window.history.state && window.history.state.quickStack) window.history.back();
    else onCloseRef.current();
  }, []);

  const advance = useCallback(() => {
    if (!canAdvance(Date.now(), lockedUntil.current)) return;
    lockedUntil.current = Date.now() + SLIDE_MS;
    setIndex((i) => nextStep(i, total).index);
    setSliding(true);
    window.setTimeout(() => setSliding(false), SLIDE_MS);
  }, [total]);

  const handleSave = useCallback(
    (specs: SaveSpec[]) => {
      // Never drop an answer. Taps during the slide are blocked on the card (pointer-events), not here.
      onSave(specs);
      advance();
    },
    [onSave, advance],
  );

  // Escape closes. Tab stays inside the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!rootRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === rootRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // New card: put focus inside unless an editor already took it (autoFocus).
  useEffect(() => {
    const el = rootRef.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, [index]);

  // The end: a calm moment if the day is full, otherwise straight back.
  useEffect(() => {
    if (!finished) return;
    if (!complete) {
      close();
      return;
    }
    const t = window.setTimeout(close, 1200);
    return () => window.clearTimeout(t);
  }, [finished, complete, close]);

  const key = cards[index];
  const last = index === total - 1;
  const common = { date, payload, queued, onSave: handleSave, submitLabel: last ? 'Done' : 'Next' };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Fill missing, ${dayLabel}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col outline-none"
      style={{ background: 'var(--surface)' }}
    >
      {finished ? (
        <button
          type="button"
          onClick={close}
          className="quick-card-in flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          aria-label="Day complete. Tap to go back"
        >
          <span className="text-4xl" aria-hidden="true" style={{ color: 'var(--ok)' }}>
            ✓
          </span>
          <span className="text-lg font-semibold">Day complete</span>
          <span className="subtle">{dayLabel} is all filled.</span>
        </button>
      ) : (
        <>
          <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-3">
            <div className="flex items-center gap-1.5" role="img" aria-label={`Card ${index + 1} of ${total}`}>
              {cards.map((c, i) => {
                const s = dotState(i, index);
                return (
                  <span
                    key={c}
                    className="h-2 rounded-full"
                    style={{
                      width: s === 'current' ? '1.25rem' : '0.5rem',
                      background: s === 'todo' ? 'var(--border)' : 'var(--ok)',
                    }}
                  />
                );
              })}
            </div>
            <span className="text-sm muted" aria-live="polite">
              {cardsLeft(index, total)} left
            </span>
            <button type="button" onClick={close} aria-label="Close" className="btn-outline min-h-11 min-w-11 rounded-full">
              ✕
            </button>
          </header>
          <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <div
              key={`${key}:${index}`}
              className="quick-card-in quick-card-body"
              style={sliding ? { pointerEvents: 'none' } : undefined}
            >
              <h2 className="text-xl font-semibold">{TITLES[key]}</h2>
              <p className="subtle mb-4">{dayLabel}</p>
              {key === 'mood' && <MoodEditor {...common} />}
              {key === 'habits' && <HabitsEditor {...common} />}
              {key === 'weight' && <WeightEditor {...common} />}
              {key === 'highlight' && <HighlightEditor {...common} />}
              {key === 'sidequests' && <QuestsEditor {...common} quests={quests} />}
              {key === 'hours' && <HoursEditor {...common} categories={categories} submitLabel="✓ Looks right" />}
            </div>
          </div>
          <footer className="mx-auto w-full max-w-md px-4 pb-4">
            <button type="button" onClick={advance} className="btn-outline min-h-11 w-full">
              Skip for now
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
