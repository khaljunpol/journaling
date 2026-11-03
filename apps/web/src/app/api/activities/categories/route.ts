import { NextResponse } from 'next/server';
import { parseCategoryMap } from '@journaling/core/habitCategory';
import { setActivityCategories, setSetting } from '@journaling/sheets/googleSheets';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

/** Saves every habit's category in one write, then marks the setup as confirmed. */
export async function PUT(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const categories = parseCategoryMap(body?.categories);
    if (!categories) return apiError('categories must map habit ids to categories', 400);
    await setActivityCategories(ctx.sheetAuth, categories);
    await setSetting(ctx.sheetAuth, 'habitCategoriesConfirmed', '1');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return apiFailure(error, 'PUT /api/activities/categories');
  }
}
