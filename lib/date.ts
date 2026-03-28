// Shared date helpers using local time

export function pad(n: number): string { return String(n).padStart(2, '0'); }
export function localISO(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function toISODate(d: Date): string { return localISO(d); }
export function localTodayISO(): string { return localISO(new Date()); }
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}
export function weekStartLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day); // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}
export function weekKey(d: Date): string {
  const ws = weekStartLocal(d);
  return `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`;
}
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
