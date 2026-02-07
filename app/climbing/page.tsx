import ClimbingViewClient from '@/components/ClimbingViewClient';

export const metadata = { title: 'Climbing' };

export default function ClimbingPage() {
  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Climbing</h2>
      <ClimbingViewClient />
    </main>
  );
}
