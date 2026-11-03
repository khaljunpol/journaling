'use client';

import { ChevronDown, Ellipsis } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ActivityTrendsClient from '@/components/ActivityTrendsClient';
import InsightsView from '@/components/insights/InsightsView';
import SummaryPromptPanel from '@/components/SummaryPromptPanel';
import TimeTrackerViewClient from '@/components/TimeTrackerViewClient';
import PageHeader from '@/components/ui/PageHeader';
import Sheet from '@/components/ui/Sheet';
import WeightTrendChart from '@/components/WeightTrendChart';
import { localTodayISO } from '@journaling/core/date';

type SectionId = 'time' | 'body' | 'habits';
const SECTIONS: Array<{ id: SectionId; title: string; hint: string }> = [
  { id: 'time', title: 'Time', hint: 'Where your hours go' },
  { id: 'body', title: 'Body', hint: 'Weight over time' },
  { id: 'habits', title: 'Habits', hint: 'How often each habit gets done' },
];

/** A row that opens its content in place. */
function Drawer({ id, title, hint, open, onToggle, children }: { id: SectionId; title: string; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section id={`section-${id}`} className="card overflow-hidden">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`section-${id}-body`} className="press flex min-h-14 w-full items-center gap-3 px-4 text-left sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium" style={{ color: 'var(--text-1)' }}>{title}</span>
          <span className="block text-[13px]" style={{ color: 'var(--text-2)' }}>{hint}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" style={{ color: 'var(--text-2)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease-out' }} />
      </button>
      {open ? <div id={`section-${id}-body`} className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div> : null}
    </section>
  );
}

type Prompt = 'journal' | 'time';

function InsightsPage() {
  const params = useSearchParams();
  const today = useMemo(() => localTodayISO(), []);
  // `?section=` opens one; old `/trends?tab=` links still land on the right section.
  const first = (params.get('section') ?? params.get('tab')) as SectionId | null;
  const [open, setOpen] = useState<Set<SectionId>>(() => new Set(first && SECTIONS.some((s) => s.id === first) ? [first] : []));
  const [menu, setMenu] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (first) document.getElementById(`section-${first}`)?.scrollIntoView({ block: 'start' });
  }, [first]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [menu]);

  const toggle = (id: SectionId) => setOpen((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Insights"
        context="What changes your days."
        actions={
          <div ref={menuRef} className="relative">
            <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="press flex size-11 items-center justify-center rounded-[10px]" style={{ color: 'var(--text-2)' }}>
              <Ellipsis size={20} aria-hidden="true" />
            </button>
            {menu ? (
              <div role="menu" className="absolute right-0 top-12 z-20 w-56 rounded-[12px] border p-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-pop)' }}>
                <button type="button" role="menuitem" className="press flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-[14px]" onClick={() => { setPrompt('journal'); setMenu(false); }}>Copy journal AI prompt</button>
                <button type="button" role="menuitem" className="press flex min-h-11 w-full items-center rounded-[8px] px-3 text-left text-[14px]" onClick={() => { setPrompt('time'); setMenu(false); }}>Copy time AI prompt</button>
              </div>
            ) : null}
          </div>
        }
      />

      <InsightsView today={today} />

      {SECTIONS.map((s) => (
        <Drawer key={s.id} {...s} open={open.has(s.id)} onToggle={() => toggle(s.id)}>
          {s.id === 'time' ? <TimeTrackerViewClient /> : s.id === 'body' ? <WeightTrendChart /> : <ActivityTrendsClient />}
        </Drawer>
      ))}

      <Sheet open={prompt !== null} onClose={() => setPrompt(null)} title="Copy AI prompt" subtitle={prompt === 'time' ? 'Time' : 'Journal'}>
        {prompt ? (
          <SummaryPromptPanel
            key={prompt}
            title={prompt === 'time' ? 'Time AI prompt' : 'Journal AI prompt'}
            endpoint={prompt === 'time' ? '/api/prompts/time' : '/api/prompts/journal'}
            anchorISO={today}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InsightsPage />
    </Suspense>
  );
}
