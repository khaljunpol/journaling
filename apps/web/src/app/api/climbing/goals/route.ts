import { NextResponse } from 'next/server';
import { listClimbGoals, upsertClimbGoal, deleteClimbGoal } from '@/lib/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET() {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const items = await listClimbGoals(ctx.sheetAuth);
    return NextResponse.json(items);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/climbing/goals');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const year = parseInt(String(body?.year ?? new Date().getFullYear()), 10);
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const target = parseInt(String(body?.target ?? '0'), 10) || 0;
    if (!grade || !target) return apiError('grade and target required', 400);
    if (grade.length > MAX_LEN.grade) return apiError(`grade must be ≤${MAX_LEN.grade} characters`, 400);
    const saved = await upsertClimbGoal(ctx.sheetAuth, { year, type, grade, target });
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/climbing/goals');
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return apiError('id required', 400);
    const out = await deleteClimbGoal(ctx.sheetAuth, id);
    return NextResponse.json(out);
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/climbing/goals');
  }
}
