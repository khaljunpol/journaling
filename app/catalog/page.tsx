import CatalogEditor from '@/components/CatalogEditor';

export const dynamic = 'force-dynamic';

export default function CatalogPage() {
  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Catalog</h2>
      <p className="text-sm text-neutral-600">Manage shared activity catalog (name, category, tags).</p>
      <div className="rounded border p-4">
        <CatalogEditor />
      </div>
    </main>
  );
}
