// Shared date helpers using local time

export function pad(n: number): string { return String(n).padStart(2, '0'); }
export function localISO(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function toISODate(d: Date): string { return localISO(d); }
export function localTodayISO(): string {
  const d = new Date();
  return localISO(d);
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
