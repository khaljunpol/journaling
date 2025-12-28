import ActivityList from '@/components/ActivityList';
import DailyHighlight from '@/components/DailyHighlight';
import MetricsChart from '@/components/MetricsChart';
import TodayChecklist from '@/components/TodayChecklist';

export default function Page() {
  return (
    <main className="space-y-8">
      <TodayChecklist />
      <DailyHighlight />
      <ActivityList />
      <MetricsChart />
    </main>
  );
}
