"use client";

import { useMemo, useState } from 'react';
import ActivityCalendar from '@/components/ActivityCalendar';
import DailyHighlight from '@/components/DailyHighlight';
import DailyWeight from '@/components/DailyWeight';

function pad(n: number) { return String(n).padStart(2, '0'); }
function localTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function JournalView() {
  const today = useMemo(() => localTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded border p-4">
        <div className="text-lg font-medium">
          {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="w-full sm:w-auto overflow-x-auto -mx-2 sm:mx-0">
          <div className="flex items-center gap-2 px-2 whitespace-nowrap">
            <button
            className="shrink-0 rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
          >
            Previous
          </button>
          <button
            className="shrink-0 rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => setSelectedDate(localTodayISO())}
          >
            Today
          </button>
          <input
            type="date"
            className="shrink-0 rounded border px-2 py-1"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            className="shrink-0 rounded border px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }}
          >
            Next
          </button>
          </div>
        </div>
      </div>

      <ActivityCalendar selectedDateISO={selectedDate} onSelectDate={setSelectedDate} />
      <DailyHighlight dateISO={selectedDate} />
      <DailyWeight dateISO={selectedDate} />
    </div>
  );
}
