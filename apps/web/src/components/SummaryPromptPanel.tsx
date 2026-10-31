"use client";

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { fieldBase } from '@/components/ui/Input';

type Period = 'week' | 'month';

type Props = {
  title: string;
  endpoint: string;
  anchorISO: string;
};

export default function SummaryPromptPanel({ title, endpoint, anchorISO }: Props) {
  const [prompt, setPrompt] = useState('');
  const [label, setLabel] = useState('');
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams({ period, anchor: anchorISO });
    return `${endpoint}?${params.toString()}`;
  }, [anchorISO, endpoint, period]);

  async function generate(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setLoading(true);
    setCopied(false);
    setError(null);
    try {
      const params = new URLSearchParams({ period: nextPeriod, anchor: anchorISO });
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not generate prompt');
        setPrompt('');
        return;
      }
      setPrompt(String(data?.prompt || ''));
      setLabel(String(data?.label || ''));
    } catch {
      setError('Could not generate prompt');
      setPrompt('');
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  }

  return (
    <section className="space-y-3 pb-2" aria-label={title}>
      <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
        Make a prompt to paste into your AI chat.
        {label && <span className="num"> {label}</span>}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={loading} onClick={() => generate('week')} aria-pressed={prompt !== '' && period === 'week'}>
          Weekly prompt
        </Button>
        <Button variant="outline" disabled={loading} onClick={() => generate('month')} aria-pressed={prompt !== '' && period === 'month'}>
          Monthly prompt
        </Button>
        <Button disabled={!prompt || loading} onClick={copyPrompt}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {error && <div role="alert" className="text-[14px]" style={{ color: 'var(--warn)' }}>{error}</div>}

      {prompt && (
        <textarea
          className={`${fieldBase} min-h-56 w-full resize-y px-3 py-2 text-[13px] leading-relaxed`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck={false}
          aria-label={`${title} preview`}
        />
      )}

      {!prompt && !error && (
        <div className="rounded-[10px] px-3 py-3 text-[13px]" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
          Choose weekly or monthly to preview a copyable prompt.
          <span className="sr-only">{fetchUrl}</span>
        </div>
      )}
    </section>
  );
}
