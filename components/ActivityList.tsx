"use client";

import { useEffect, useState } from 'react';

type Activity = { id: string; name: string };

export default function ActivityList() {
  const [items, setItems] = useState<Activity[]>([]);
  const [name, setName] = useState('');

  async function refresh() {
    const res = await fetch('/api/activities');
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => { refresh(); }, []);

  async function add() {
    if (!name.trim()) return;
    await fetch('/api/activities', { method: 'POST', body: JSON.stringify({ name }), headers: { 'Content-Type': 'application/json' } });
    setName('');
    refresh();
  }

  async function update(id: string, newName: string) {
    await fetch(`/api/activities/${id}`, { method: 'PATCH', body: JSON.stringify({ name: newName }), headers: { 'Content-Type': 'application/json' } });
    refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Activities</h2>
      <div className="flex gap-2">
        <input className="flex-1 rounded border px-2 py-1" placeholder="New activity" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black" onClick={add}>Add</button>
      </div>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <input className="flex-1 rounded border px-2 py-1" defaultValue={a.name} onBlur={(e) => update(a.id, e.target.value)} />
            <button className="rounded border px-2 py-1" onClick={() => remove(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
