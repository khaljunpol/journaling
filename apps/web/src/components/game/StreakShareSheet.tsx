'use client';

import { Download, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, renderStreakCard } from '@/components/climbing/storyImage';
import Button from '@/components/ui/Button';
import Sheet from '@/components/ui/Sheet';
import { sharePayload, STREAK_FILE, streakCardData } from '@/lib/streakCard';
import type { Streak } from '@journaling/core/streaks';

/** Preview first, then Share (phone) or Save. The card shows only the name, streak, best and level. */
export default function StreakShareSheet({ streak, level, bad, onClose }: { streak: Streak | null; level: number; bad: boolean; onClose: () => void }) {
  const [hide, setHide] = useState(false);
  const [shown, setShown] = useState<{ url: string; blob: Blob } | null>(null);
  const [note, setNote] = useState('');
  const urlRef = useRef<string | null>(null);
  const data = streak ? streakCardData(streak, level, hide, bad) : null;
  const key = data ? JSON.stringify(data) : null;

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setShown(null);
    (async () => {
      const blob = await canvasToBlob(await renderStreakCard(data));
      if (cancelled || !blob) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setShown({ url: urlRef.current, blob });
    })();
    return () => { cancelled = true; };
  // data is covered by key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function share() {
    if (!shown) return;
    const file = new File([shown.blob], STREAK_FILE, { type: 'image/png' });
    const payload = sharePayload(file);
    if (navigator.canShare?.(payload)) {
      try { await navigator.share(payload); } catch { /* closed the share sheet */ }
      return;
    }
    save();
  }

  function save() {
    if (!shown) return;
    const a = document.createElement('a');
    a.href = shown.url;
    a.download = STREAK_FILE;
    a.click();
    setNote('Saved.');
  }

  return (
    <Sheet open={streak !== null} onClose={() => { setNote(''); setHide(false); onClose(); }} title="Share streak" subtitle="Name, streak, best and level only" initialFocus="panel">
      {!data ? (
        <p className="pt-2 text-[14px]" style={{ color: 'var(--text-2)' }}>Tracked-only habits have no card.</p>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="overflow-hidden rounded-[12px]" style={{ background: 'var(--surface-2)', aspectRatio: '1080 / 1350' }}>
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown.url} alt={`${data.title}: ${data.streak} ${data.unit} in a row, best ${data.best}, level ${data.level}`} className="h-full w-full" />
            ) : null}
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]" style={{ color: 'var(--text-1)' }}>
            Hide habit name
            <input type="checkbox" role="switch" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          </label>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={share} disabled={!shown}><Share2 size={16} aria-hidden="true" />Share</Button>
            <Button variant="outline" onClick={save} disabled={!shown} aria-label="Save image"><Download size={16} aria-hidden="true" /></Button>
          </div>
          {note ? <p role="status" className="text-[13px]" style={{ color: 'var(--text-2)' }}>{note}</p> : null}
        </div>
      )}
    </Sheet>
  );
}
