import MetricsChartClient from '@/components/MetricsChartClient';

export const metadata = { title: 'Metrics' };

export default function MetricsPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <MetricsChartClient />
    </main>
  );
}
