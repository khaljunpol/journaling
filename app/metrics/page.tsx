import MetricsChartClient from '@/components/MetricsChartClient';

export const metadata = { title: 'Metrics' };

export default function MetricsPage() {
  return (
    <main className="space-y-8">
      <h2 className="text-xl font-semibold">Consistency Metrics</h2>
      <MetricsChartClient />
    </main>
  );
}
