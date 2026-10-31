'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input, { Label, Textarea } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { normalizeGrade } from '@journaling/core/climbing';
import { fallsLabel, gradesFor, type LogEntry } from './types';

type Props = {
  open: boolean;
  /** The log being edited. Keep it set while the sheet closes so it does not empty during the slide-out. */
  log: LogEntry | null;
  onClose: () => void;
  /** Resolves true when saved (the sheet is then closed by the parent). */
  onSave: (next: LogEntry) => Promise<boolean>;
  onDelete: (log: LogEntry) => void;
  onShareClimb: (log: LogEntry) => void;
  onShareDay: (date: string) => void;
  moreStyles: Array<{ label: string; run: () => void }>;
};

export default function LogEditSheet({ open, log, onClose, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit climb" subtitle={log ? `${log.grade} · ${log.type === 'boulder' ? 'Boulder' : 'Rope'}` : undefined}>
      {log && <EditBody key={log.id} log={log} {...rest} />}
    </Sheet>
  );
}

function EditBody({ log, onSave, onDelete, onShareClimb, onShareDay, moreStyles }: Omit<Props, 'open' | 'onClose' | 'log'> & { log: LogEntry }) {
  const list = gradesFor(log.type);
  // Old rows may hold "v4" or an odd grade: match it to the list, or keep it as an extra option.
  const start = list.find((g) => normalizeGrade(log.type, g) === normalizeGrade(log.type, log.grade)) ?? log.grade;
  const [grade, setGrade] = useState(start);
  const [attempts, setAttempts] = useState(log.attempts);
  const [custom, setCustom] = useState(String(log.attempts >= 4 ? log.attempts : 4));
  const [session, setSession] = useState(String(log.session));
  const [date, setDate] = useState(log.date.slice(0, 10));
  const [location, setLocation] = useState(log.location ?? '');
  const [notes, setNotes] = useState(log.notes ?? '');
  const [saving, setSaving] = useState(false);

  const bigFalls = attempts >= 4;
  const customN = parseInt(custom, 10);
  const sessionN = parseInt(session, 10);
  const valid = !!date && Number.isInteger(sessionN) && sessionN >= 1 && sessionN <= 99 && (!bigFalls || (Number.isInteger(customN) && customN >= 4 && customN <= 99));

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const ok = await onSave({ ...log, grade, attempts: bigFalls ? customN : attempts, session: sessionN, date, location: location.trim(), notes: notes.trim() });
    if (!ok) setSaving(false);
  }

  const options = list.includes(grade) ? list : [grade, ...list];
  const outcome = (n: number | 'more') => {
    const on = n === 'more' ? bigFalls : attempts === n;
    return (
      <button
        key={n}
        type="button"
        aria-pressed={on}
        onClick={() => setAttempts(n === 'more' ? Math.max(4, customN || 4) : n)}
        className="min-h-11 rounded-[10px] border text-[14px] font-medium"
        style={on
          ? { background: 'var(--accent-fill)', borderColor: 'var(--accent-fill)', color: 'var(--on-accent-fill)' }
          : { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
      >
        {n === 0 ? 'Flash' : <span className="num">{n === 'more' ? '4+' : n}</span>}
      </button>
    );
  };

  return (
    <form className="space-y-3 pt-1" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div>
        <Label htmlFor="le-grade">Grade</Label>
        <Select id="le-grade" className="w-full" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {options.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </div>

      <div>
        <Label>Outcome ({fallsLabel(bigFalls && customN ? customN : attempts)})</Label>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Outcome">
          {[0, 1, 2, 3].map((n) => outcome(n))}
          {outcome('more')}
        </div>
        {bigFalls && (
          <Input className="mt-2" aria-label="Falls (4 to 99)" type="number" inputMode="numeric" min={4} max={99} value={custom} onChange={(e) => { setCustom(e.target.value); }} />
        )}
        {bigFalls && !(Number.isInteger(customN) && customN >= 4 && customN <= 99) && (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-2)' }}>Use a number from 4 to 99.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="le-session">Session</Label>
          <Input id="le-session" type="number" inputMode="numeric" min={1} max={99} value={session} onChange={(e) => setSession(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="le-date">Date</Label>
          <Input id="le-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="le-gym">Gym</Label>
        <Input id="le-gym" placeholder="Optional" maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="le-notes">Notes</Label>
        <Textarea id="le-notes" rows={2} placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button type="submit" className="w-full" disabled={!valid || saving}>{saving ? 'Saving…' : 'Save'}</Button>

      <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onShareClimb(log)}>Share this climb</Button>
          <Button variant="outline" onClick={() => onShareDay(log.date.slice(0, 10))}>Share story</Button>
        </div>
        {moreStyles.length > 0 && (
          <div>
            <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: 'var(--text-3)' }}>More styles</div>
            <div className="flex flex-wrap gap-2">
              {moreStyles.map((s) => <Button key={s.label} small variant="outline" onClick={s.run}>{s.label}</Button>)}
            </div>
          </div>
        )}
      </div>

      <Button variant="ghost" className="w-full" style={{ color: 'var(--warn)' }} onClick={() => onDelete(log)}>Delete</Button>
    </form>
  );
}
