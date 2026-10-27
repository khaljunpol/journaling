import { NextResponse } from 'next/server';
import { listClimbLogs, addClimbLog, deleteClimbLog } from '@/lib/googleSheets';
import { apiError, MAX_LEN, apiFailure } from '@/lib/apiHelpers';
import { requireSheetContext } from '@/lib/sheetAuth';

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limitParam = url.searchParams.get('limit');
    const pageParam = url.searchParams.get('page');
    if (from && to) {
      const items = await listClimbLogs(ctx.sheetAuth, from, to);
      return NextResponse.json(items);
    }
    if (date) {
      const items = await listClimbLogs(ctx.sheetAuth, date, date);
      return NextResponse.json(items);
    }
    const items = await listClimbLogs(ctx.sheetAuth);
    if (limitParam) {
      const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10));
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
      const sorted = items.slice().sort((a, b) => {
        const ad = new Date(a.date).getTime(); const bd = new Date(b.date).getTime();
        if (bd !== ad) return bd - ad;
        if (b.session !== a.session) return (b.session || 0) - (a.session || 0);
        return String(b.id).localeCompare(String(a.id));
      });
      const paged = { items: sorted.slice((page - 1) * limit, page * limit), total: sorted.length, page, limit };
      return NextResponse.json(paged);
    }
    return NextResponse.json(items);
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/climbing/logs');
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const date = String(body?.date || '').slice(0, 10);
    const session = parseInt(String(body?.session ?? '0'), 10) || 0;
    const type = (String(body?.type || 'boulder').toLowerCase() === 'rope' ? 'rope' : 'boulder') as 'boulder' | 'rope';
    const grade = String(body?.grade || '').trim();
    const attempts = parseInt(String(body?.attempts ?? '0'), 10) || 0;
    const location = String(body?.location || '').trim();
    const notes = String(body?.notes || '').trim();
    if (!date) return apiError('date required', 400);
    if (grade.length > MAX_LEN.grade) return apiError(`grade must be ≤${MAX_LEN.grade} characters`, 400);
    if (location.length > MAX_LEN.location) return apiError(`location must be ≤${MAX_LEN.location} characters`, 400);
    if (notes.length > MAX_LEN.notes) return apiError(`notes must be ≤${MAX_LEN.notes} characters`, 400);
    const saved = await addClimbLog(ctx.sheetAuth, { date, session, type, grade, attempts, location, notes });
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/climbing/logs');
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return apiError('id required', 400);
    const out = await deleteClimbLog(ctx.sheetAuth, id);
    return NextResponse.json(out);
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/climbing/logs');
  }
}
