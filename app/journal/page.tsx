import JournalView from '@/components/JournalView';

export const metadata = { title: 'Journal' };

export default function JournalPage() {
  return (
    <main className="space-y-8">
      <h2 className="text-xl font-semibold">Journal</h2>
      <JournalView />
    </main>
  );
}
