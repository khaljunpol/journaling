import JournalView from '@/components/JournalView';

export const metadata = { title: 'Journal' };

export default function JournalPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <JournalView />
    </main>
  );
}
