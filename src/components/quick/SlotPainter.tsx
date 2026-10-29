"use client";

import { useEffect, useRef, useState } from 'react';
import type { TimeCategory } from '@/lib/types';
import { inkOn } from '@/lib/contrast';

const COLS = 6;

type Props = {
  value: Array<number | null>;
  categories: TimeCategory[];
  onChange: (next: Array<number | null>) => void;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export default function SlotPainter({ value, categories, onChange }: Props) {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const [picked, setPicked] = useState<number | 'clear' | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastRef = useRef<number>(-1);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const firstId = sorted.length ? Number(sorted[0].id) : null;
  const active: number | 'clear' | null = picked ?? firstId;

  function colorOf(id: number | null) {
    if (id === null) return undefined;
    return categories.find((c) => Number(c.id) === id)?.color;
  }
  function nameOf(id: number | null) {
    if (id === null) return 'empty';
    return categories.find((c) => Number(c.id) === id)?.name ?? String(id);
  }

  function indexAt(e: React.PointerEvent): number {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest('[data-slot]');
    if (!cell || !gridRef.current?.contains(cell)) return -1;
    return Number(cell.getAttribute('data-slot'));
  }

  function paintAt(i: number) {
    if (i < 0 || i > 23 || active === null || i === lastRef.current) return;
    lastRef.current = i;
    const next = active === 'clear' ? null : active;
    if (valueRef.current[i] === next) return;
    const arr = valueRef.current.slice();
    arr[i] = next;
    valueRef.current = arr;
    onChange(arr);
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    draggingRef.current = true;
    lastRef.current = -1;
    e.currentTarget.setPointerCapture(e.pointerId);
    paintAt(indexAt(e));
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    paintAt(indexAt(e));
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    lastRef.current = -1;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  // Keyboard: Enter or Space paints the focused slot.
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      lastRef.current = -1;
      paintAt(i);
      lastRef.current = -1;
    }
  }

  const chipBase = 'slot-chip flex min-h-11 items-center gap-2 rounded-full px-3.5 text-xs font-medium';

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Painting with" className="flex flex-wrap gap-2">
        {sorted.map((c) => {
          const id = Number(c.id);
          const on = active === id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(id)}
              className={chipBase}
              style={on
                ? { background: `${c.color}22`, color: c.color, boxShadow: `0 0 0 1.5px ${c.color}` }
                : { background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
              {c.name}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={active === 'clear'}
          onClick={() => setPicked('clear')}
          className={chipBase}
          style={active === 'clear'
            ? { background: 'var(--surface-alt)', color: 'var(--text)', boxShadow: '0 0 0 1.5px var(--text)' }
            : { background: 'var(--surface-alt)', color: 'var(--muted-foreground)' }}
        >
          Clear
        </button>
      </div>

      <div
        ref={gridRef}
        className="grid gap-1.5 select-none"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {value.map((v, i) => {
          const bg = colorOf(v);
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              data-slot={i}
              aria-label={`${pad2(i)}:00, ${nameOf(v)}`}
              onKeyDown={(e) => onKey(e, i)}
              className="slot-cell flex min-h-12 items-center justify-center rounded-lg text-xs font-semibold tabular-nums"
              style={{
                background: bg ?? 'var(--surface-alt)',
                // Hour numbers stay readable on dark category colours too.
                color: bg ? (inkOn(bg) === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)') : 'var(--muted-foreground)',
                border: bg ? '1px solid transparent' : '1px dashed var(--border)',
              }}
            >
              {pad2(i)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
