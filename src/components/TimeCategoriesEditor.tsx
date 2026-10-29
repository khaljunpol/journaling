"use client";

import { useEffect, useRef, useState } from 'react';
import type { TimeCategory as Category } from '@/lib/types';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Input, { Label } from '@/components/ui/Input';
import { groupOf } from '@/lib/timeBalance';

type GroupChoice = NonNullable<Category['group']>;
/** Groups feed the Productive / Rest / Sleep split on Trends > Time. */
const GROUP_CHOICES: Array<[GroupChoice, string]> = [
  ['productive', 'Productive'],
  ['rest', 'Rest'],
  ['sleep', 'Sleep'],
  ['none', 'No group'],
];

export default function TimeCategoriesEditor() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#888888');
  const [isSaving, setIsSaving] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  async function refresh() {
    try {
      if (ctrlRef.current) ctrlRef.current.abort();
      const controller = new AbortController();
      ctrlRef.current = controller;
      const res = await fetch('/api/time/categories', { signal: controller.signal });
      if (!res.ok) { setItems([]); return; }
      const list: Category[] = await res.json();
      setItems(list || []);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setItems([]);
    }
  }

  useEffect(() => { refresh(); }, []);

  function updateItem(id: string, patch: Partial<Category>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveNew() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const order = (items?.length || 0) + 1;
      const res = await fetch('/api/time/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed, color, order }) });
      if (res.ok) {
        setName(''); setColor('#888888');
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEdit(it: Category, patch: Partial<Category>) {
    setIsSaving(true);
    try {
      const body = {
        id: it.id,
        name: patch.name ?? it.name,
        color: patch.color ?? it.color,
        order: patch.order ?? it.order,
        // Sent only when changed, so a rename or move never touches the saved group.
        ...('group' in patch ? { group: patch.group ?? '' } : {}),
      };
      const res = await fetch('/api/time/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(it: Category) {
    if (!confirm(`Delete category "${it.name}"?`)) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/time/categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id }) });
      if (res.ok) refresh();
    } finally {
      setIsSaving(false);
    }
  }

  function move(it: Category, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === it.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const other = sorted[targetIdx];
    saveEdit(it, { order: other.order });
    saveEdit(other, { order: it.order });
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const bar = <div className="h-5 w-1 rounded-full" style={{ background: 'var(--accent)' }} />;

  return (
    <section className="space-y-4">
      <h2 className="text-[20px] font-semibold" style={{ color: 'var(--text-1)' }}>Time categories</h2>

      {/* Add */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          {bar}
          <span className="text-[14px] font-medium">Add category</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="new-category">Name</Label>
            <Input id="new-category" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveNew()} />
          </div>
          <div>
            <Label htmlFor="new-category-color">Color</Label>
            <input
              id="new-category-color"
              className="h-11 w-12 cursor-pointer rounded-[10px] border p-1"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <Button onClick={saveNew} disabled={isSaving || !name.trim()}>Add</Button>
        </div>
      </Card>

      {/* List */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          {bar}
          <span className="text-[14px] font-medium">Categories</span>
          <Chip>{sorted.length}</Chip>
        </div>
        {sorted.length === 0 && <div className="text-[14px]" style={{ color: 'var(--text-2)' }}>No categories yet.</div>}
        <div className="space-y-2">
          {sorted.map((it, i) => (
            <div key={it.id} className="flex flex-wrap items-center gap-2 rounded-[10px] px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-4" style={{ background: 'var(--surface-2)' }}>
              <input
                aria-label={`Colour for ${it.name}`}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-[10px] p-0.5"
                type="color"
                value={it.color}
                style={{ border: '2px solid var(--border)' }}
                onInput={(e) => updateItem(it.id, { color: (e.target as HTMLInputElement).value })}
                onBlur={() => {
                  const curr = items.find((x) => x.id === it.id);
                  if (curr) saveEdit(curr, { color: curr.color });
                }}
              />
              <Input
                aria-label="Category name"
                className="min-w-0 flex-1 font-medium"
                value={it.name}
                onChange={(e) => updateItem(it.id, { name: e.target.value })}
                onBlur={() => {
                  const curr = items.find((x) => x.id === it.id);
                  if (curr) saveEdit(curr, { name: curr.name });
                }}
              />
              <select
                aria-label={`Group for ${it.name}`}
                className="input h-11 shrink-0 text-[14px]"
                value={it.group ?? groupOf(it) ?? 'none'}
                onChange={(e) => {
                  const group = e.target.value as GroupChoice;
                  updateItem(it.id, { group });
                  saveEdit(it, { group });
                }}
              >
                {GROUP_CHOICES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" small aria-label={`Move ${it.name} up`} onClick={() => move(it, -1)} disabled={i === 0}>↑</Button>
                <Button variant="outline" small aria-label={`Move ${it.name} down`} onClick={() => move(it, 1)} disabled={i === sorted.length - 1}>↓</Button>
                <Button variant="ghost" small onClick={() => remove(it)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
