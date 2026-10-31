'use client';

import { useState } from 'react';
import type { EditorProps } from './types';

export default function WeightEditor({ date, payload, onSave, submitLabel }: EditorProps) {
  const [text, setText] = useState(() => {
    const w = payload.days[date]?.weight;
    return w === null || w === undefined ? '' : String(w);
  });
  const value = parseFloat(text.replace(',', '.'));
  const valid = Number.isFinite(value) && value > 0 && value < 1000;

  function save() {
    if (!valid) return;
    onSave([{ key: `weight:${date}`, url: '/api/weights', method: 'POST', body: { date, weight: value } }]);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="block">
        <span className="subtle">Weight (kg)</span>
        <input
          className="input mt-1 min-h-12 w-full text-lg"
          type="text"
          inputMode="decimal"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="72.4"
        />
      </label>
      <button type="submit" className="btn min-h-12 w-full" disabled={!valid}>
        {submitLabel ?? 'Save'}
      </button>
    </form>
  );
}
