// Shared mood utilities and definitions

export type MoodDef = { score: number; emoji: string; label: string; color: string };

// Color palette: red → amber → neutral → blue/green → emerald
export const MOODS: MoodDef[] = [
    { score: 0, emoji: '😭', label: 'Terrible', color: '#991b1b' },
    { score: 1, emoji: '😢', label: 'Very Bad', color: '#b91c1c' },
    { score: 2, emoji: '☹️', label: 'Bad', color: '#ef4444' },
    { score: 3, emoji: '🙁', label: 'Down', color: '#f97316' },
    { score: 4, emoji: '😕', label: 'Meh', color: '#f59e0b' },
    { score: 5, emoji: '😐', label: 'Neutral', color: '#9ca3af' },
    { score: 6, emoji: '🙂', label: 'Okay', color: '#60a5fa' },
    { score: 7, emoji: '😊', label: 'Good', color: '#22c55e' },
    { score: 8, emoji: '😃', label: 'Great', color: '#16a34a' },
    { score: 9, emoji: '😁', label: 'Awesome', color: '#10b981' },
    { score: 10, emoji: '🤩', label: 'Excellent', color: '#059669' },
];

export function clampMood(score: number): number {
    if (!Number.isFinite(score)) return 0;
    const s = Math.round(score);
    return Math.max(0, Math.min(10, s));
}

export function moodEmoji(score: number): string {
    const s = clampMood(score);
    const found = MOODS.find((m) => m.score === s);
    return found ? found.emoji : '';
}

export function moodLabel(score: number): string {
    const s = clampMood(score);
    const found = MOODS.find((m) => m.score === s);
    return found ? found.label : String(s);
}

export function moodColor(score: number): string {
    const s = clampMood(score);
    const found = MOODS.find((m) => m.score === s);
    return found ? found.color : '#9ca3af';
}

function hexToRgba(hex: string, alpha: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function moodBackground(score: number, alpha = 0.14): string {
    return hexToRgba(moodColor(score), alpha);
}
