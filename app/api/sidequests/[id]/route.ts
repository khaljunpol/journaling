import { NextResponse } from 'next/server';
import { requireSheetContext } from '@/lib/sheetAuth';
import { apiError, apiFailure } from '@/lib/apiHelpers';
import {
  getSidequest, updateSidequest, deleteSidequest,
  listSidequestLogs, addSidequestLog, deleteSidequestLog,
} from '@/lib/sidequests';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await params;
    const [sq, logs] = await Promise.all([
      getSidequest(ctx.sheetAuth, id),
      listSidequestLogs(ctx.sheetAuth, id),
    ]);
    if (!sq) return apiError('Not found', 404);
    return NextResponse.json({ ...sq, logs });
  } catch (error: unknown) {
    return apiFailure(error, 'GET /api/sidequests/[id]');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await params;
    const body = await req.json();
    // Strip non-patchable fields
    const { id: _id, createdAt: _c, ...patch } = body;
    void _id; void _c;
    const updated = await updateSidequest(ctx.sheetAuth, id, patch);
    if (!updated) return apiError('Not found', 404);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return apiFailure(error, 'PATCH /api/sidequests/[id]');
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await params;
    await deleteSidequest(ctx.sheetAuth, id);
    return NextResponse.json({ id });
  } catch (error: unknown) {
    return apiFailure(error, 'DELETE /api/sidequests/[id]');
  }
}

// POST /api/sidequests/[id]?action=log — add a log entry
// DELETE /api/sidequests/[id]?action=log&logId=xxx — delete a log entry
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'log') {
      const body = await req.json();
      const today = new Date().toISOString().slice(0, 10);
      const log = await addSidequestLog(ctx.sheetAuth, {
        sidequestId: id,
        date: String(body.date || today),
        value: body.value != null ? parseFloat(String(body.value)) : undefined,
        value2: body.value2 != null ? parseFloat(String(body.value2)) : undefined,
        note: body.note ? String(body.note).slice(0, 200) : undefined,
        milestoneIndex: body.milestoneIndex != null ? parseInt(String(body.milestoneIndex), 10) : undefined,
      });

      // If milestone: mark the milestone completedAt on the sidequest itself
      // Client sends current milestones array to avoid an extra read
      if (body.milestoneIndex != null) {
        const idx = parseInt(String(body.milestoneIndex), 10);
        const clientMilestones: Array<{ label: string; completedAt?: string }> | undefined =
          Array.isArray(body.milestones) ? body.milestones : undefined;
        if (clientMilestones) {
          const milestones = clientMilestones.map((m, i) =>
            i === idx ? { ...m, completedAt: log.date } : m
          );
          const allDone = milestones.every((m) => m.completedAt);
          const alreadyCompleted: boolean = !!body.sqCompletedAt;
          await updateSidequest(ctx.sheetAuth, id, {
            milestones,
            ...(allDone && !alreadyCompleted ? { completedAt: log.date } : {}),
          });
        } else {
          // Fallback: read from sheet
          const sq = await getSidequest(ctx.sheetAuth, id);
          if (sq?.milestones) {
            const milestones = sq.milestones.map((m, i) =>
              i === idx ? { ...m, completedAt: log.date } : m
            );
            const allDone = milestones.every((m) => m.completedAt);
            await updateSidequest(ctx.sheetAuth, id, {
              milestones,
              ...(allDone && !sq.completedAt ? { completedAt: log.date } : {}),
            });
          }
        }
      }

      // If oneoff: mark completed
      if (action === 'log' && body.complete === true) {
        await updateSidequest(ctx.sheetAuth, id, {
          completedAt: String(body.date || today),
        });
      }

      return NextResponse.json(log, { status: 201 });
    }

    return apiError('Unknown action', 400);
  } catch (error: unknown) {
    return apiFailure(error, 'POST /api/sidequests/[id]');
  }
}

// DELETE log entry via query param
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSheetContext();
    if ('status' in ctx) return ctx;
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get('logId');
    void params;
    if (!logId) return apiError('logId required', 400);
    await deleteSidequestLog(ctx.sheetAuth, logId);
    return NextResponse.json({ logId });
  } catch (error: unknown) {
    return apiFailure(error, 'PUT /api/sidequests/[id]');
  }
}
