import { NextResponse } from 'next/server';
import { listClimbGoals, upsertClimbGoal, deleteClimbGoal } from '@/lib/googleSheets';
import { apiError, getAccountParam, getErrorMessage, MAX_LEN } from '@/lib/apiHelpers';
import { createApiCache } from '@/lib/apiCache';

const cache = createApiCache(60_000);
const getKey = (account: string) => `goals:${account}`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const key = getKey(account);
    const cached = cache.get(key);
    if (cached) return NextResponse.json(cached);
    const items = await listClimbGoals(account);
    cache.set(key, items);
    return NextResponse.json(items);
  } catch (error: unknown) {
    console.error('[GET /api/climbing/goals]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const body = await req.json();
    const year = parseInt(String(body?.year ?? new Date().getFullYear()), 10);
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const target = parseInt(String(body?.target ?? '0'), 10) || 0;
    if (!grade || !target) return apiError('grade and target required', 400);
    if (grade.length > MAX_LEN.grade) return apiError(`grade must be ≤${MAX_LEN.grade} characters`, 400);
    const saved = await upsertClimbGoal(account, { year, type, grade, target });
    cache.invalidate();
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/climbing/goals]', error);
    return apiError(getErrorMessage(error), 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const account = getAccountParam(url);
    if (!account) return apiError('Invalid account', 400);
    const id = url.searchParams.get('id');
    if (!id) return apiError('id required', 400);
    const out = await deleteClimbGoal(account, id);
    cache.invalidate();
    return NextResponse.json(out);
  } catch (error: unknown) {
    console.error('[DELETE /api/climbing/goals]', error);
    return apiError(getErrorMessage(error), 500);
  }
}
