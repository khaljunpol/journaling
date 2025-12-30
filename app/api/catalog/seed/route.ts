import { NextRequest, NextResponse } from 'next/server';
import { SUGGESTED_ACTIVITIES } from '@/lib/activityCatalog';
import { createCatalogItem, listCatalog } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

function deriveCategory(name: string, tags: string[]): string {
  const lower = name.trim().toLowerCase();
  const set = new Set(tags.map((t) => t.trim().toLowerCase()));
  if (lower === 'coffee' || set.has('caffeine')) return 'coffee';
  if (lower === 'alcohol' || set.has('consumption')) return 'alcohol';
  if (set.has('content') || set.has('social')) return 'content';
  if (set.has('supplement')) return 'supplements';
  if (set.has('leisure') || lower === 'video games') return 'video games';
  if (set.has('exercise')) return 'gym';
  return 'misc';
}

export async function POST(req: NextRequest) {
  try {
    // Optional simple guard: require ADMIN_PASSWORD header match
    const admin = process.env.ADMIN_PASSWORD;
    if (admin) {
      const hdr = req.headers.get('x-admin');
      if (hdr !== admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const exist = await listCatalog();
    const existingNames = new Set((exist || []).map((c) => c.name.trim().toLowerCase()));

    const created: Array<{ name: string; category: string }> = [];
    for (const s of SUGGESTED_ACTIVITIES) {
      const name = s.name.trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) continue;
      const category = deriveCategory(name, s.tags || []);
      const tags = (s.tags || []).join(',');
      await createCatalogItem(name, category, tags);
      created.push({ name, category });
    }
    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || 'Unknown error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function OPTIONS() { return NextResponse.json({ ok: true }); }
export async function HEAD() { return NextResponse.json({ ok: true }); }
