import ActivityList from '@/components/ActivityList';
import ActivityTrendsClient from '@/components/ActivityTrendsClient';

export const metadata = { title: 'Activities' };

export default function ActivitiesPage() {
  return (
    <div className="space-y-6">
      <ActivityList />
      <ActivityTrendsClient />
    </div>
  );
}
