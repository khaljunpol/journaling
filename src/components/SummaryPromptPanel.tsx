"use client";

import { useMemo, useState } from 'react';

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
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Generate a prompt to paste into your AI chat.
          </p>
        </div>
        {label && (
          <span className="hidden sm:inline text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {label}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs"
          disabled={loading}
          onClick={() => generate('week')}
        >
          Weekly prompt
        </button>
        <button
          type="button"
          className="btn-outline px-3 py-1.5 text-xs"
          disabled={loading}
          onClick={() => generate('month')}
        >
          Monthly prompt
        </button>
        <button
          type="button"
          className="btn px-3 py-1.5 text-xs"
          disabled={!prompt || loading}
          onClick={copyPrompt}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {prompt && (
        <textarea
          className="input min-h-56 w-full resize-y text-xs leading-relaxed"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck={false}
          aria-label={`${title} prompt preview`}
        />
      )}

      {!prompt && !error && (
        <div className="rounded-xl border px-3 py-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          Choose weekly or monthly to preview a copyable prompt.
          <span className="sr-only">{fetchUrl}</span>
        </div>
      )}
    </section>
  );
}
