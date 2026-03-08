import ClimbingViewClient from '@/components/ClimbingViewClient';

export const metadata = { title: 'Climbing' };

export default function ClimbingPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <ClimbingViewClient />
    </main>
  );
}
