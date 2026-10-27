'use client';

import { useState } from 'react';
import type { EditorProps } from './types';

export default function HighlightEditor({ date, payload, onSave }: EditorProps) {
  const [text, setText] = useState(payload.days[date]?.highlight ?? '');
  const ok = text.trim() !== '';
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="subtle">One good thing from this day</span>
        <textarea
          className="input mt-1 min-h-28 w-full text-base"
          autoFocus
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn min-h-12 w-full"
        disabled={!ok}
        onClick={() => onSave([{ key: `highlight:${date}`, url: '/api/highlights', method: 'POST', body: { date, text: text.trim() } }])}
      >
        Save
      </button>
    </div>
  );
}
