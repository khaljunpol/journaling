import ActivityList from '@/components/ActivityList';

export const metadata = { title: 'Activities' };

export default function ActivitiesPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <ActivityList />
    </main>
  );
}
