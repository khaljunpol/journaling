import { NextResponse } from 'next/server';
import { requireSheetContext } from '@/lib/sheetAuth';
import { apiError, getErrorMessage } from '@/lib/apiHelpers';
import { listSidequests, createSidequest, listSidequestLogs, warmupSidequestSheets } from '@/lib/sidequests';
import type { SidequestType } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const includeLogs = searchParams.get('logs') === 'true';

    if (includeLogs) {
      // Warm up both sheets first so the parallel reads don't race on ensureSheet
      await warmupSidequestSheets(ctx.sheetAuth, ctx.account);
      const [sqs, allLogs] = await Promise.all([
        listSidequests(ctx.sheetAuth, ctx.account, year),
        listSidequestLogs(ctx.sheetAuth, ctx.account),
      ]);
      return NextResponse.json(sqs.map((sq) => ({
        ...sq,
        logs: allLogs.filter((l) => l.sidequestId === sq.id),
      })));
    }

    const data = await listSidequests(ctx.sheetAuth, ctx.account, year);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[GET /api/sidequests]', getErrorMessage(error));
    return apiError('Failed to fetch sidequests', 503);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const body = await req.json();
    const title = String(body.title || '').trim().slice(0, 120);
    if (!title) return apiError('title required', 400);
    const type: SidequestType = ['milestone', 'pb', 'timed', 'count', 'oneoff'].includes(body.type)
      ? body.type : 'oneoff';
    const year = parseInt(String(body.year || new Date().getFullYear()), 10) || new Date().getFullYear();
    const data = await createSidequest(ctx.sheetAuth, ctx.account, {
      title, type, year,
      unit: body.unit ? String(body.unit).slice(0, 32) : undefined,
      target: body.target != null ? parseFloat(String(body.target)) : undefined,
      milestones: Array.isArray(body.milestones) ? body.milestones.slice(0, 50) : undefined,
      description: body.description ? String(body.description).slice(0, 500) : undefined,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/sidequests]', getErrorMessage(error));
    return apiError('Failed to create sidequest', 503);
  }
}
