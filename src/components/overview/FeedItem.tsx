import { Clock, ListChecks, Mountain, PenLine, Scale, Smile, Sparkles } from 'lucide-react';
import type { FeedEntry } from '@/lib/overview';

const ICON = {
  mood: Smile,
  habits: ListChecks,
  weight: Scale,
  sidequests: Sparkles,
  hours: Clock,
  highlight: PenLine,
  climb: Mountain,
} as const;

const STATE = {
  saved: { color: 'var(--ok)', label: 'Saved' },
  pending: { color: 'var(--sync)', label: 'Saving' },
  failed: { color: 'var(--warn)', label: 'Not saved yet' },
} as const;

/** One saved entry from today: icon, text, sync dot. No times exist in the sheet, so none are shown. */
export default function FeedItem({ entry, className = '' }: { entry: FeedEntry; className?: string }) {
  const Icon = ICON[entry.kind];
  const st = STATE[entry.state];
  return (
    <li className={`feed-in flex min-h-11 items-center gap-3 ${className}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--text-1)' }}>{entry.text}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${entry.state === 'pending' ? 'sync-pulse' : ''}`} style={{ background: st.color }} />
        <span className={entry.state === 'saved' ? 'sr-only' : ''}>{st.label}</span>
      </span>
    </li>
  );
}
