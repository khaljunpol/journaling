import CatalogEditor from '@/components/CatalogEditor';

export const dynamic = 'force-dynamic';

export default function CatalogPage() {
  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 space-y-6">
      <CatalogEditor />
    </main>
  );
}
