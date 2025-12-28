"use client";

import { useMemo, useState } from 'react';
import ActivityCalendar from '@/components/ActivityCalendar';
import DailyHighlight from '@/components/DailyHighlight';

export default function JournalView() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-4">
        <div className="text-lg font-medium">
          {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setUTCDate(d.getUTCDate() - 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
          >
            Previous
          </button>
          <input
            type="date"
            className="rounded border px-2 py-1"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            className="rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setUTCDate(d.getUTCDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
          >
            Next
          </button>
        </div>
      </div>

      <ActivityCalendar selectedDateISO={selectedDate} onSelectDate={setSelectedDate} />
      <DailyHighlight dateISO={selectedDate} />
    </div>
  );
}
