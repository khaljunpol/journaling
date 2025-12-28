import ActivityList from '@/components/ActivityList';

export const metadata = { title: 'Activities' };

export default function ActivitiesPage() {
  return (
    <main className="space-y-8">
      <h2 className="text-xl font-semibold">Manage Activities</h2>
      <ActivityList />
    </main>
  );
}
