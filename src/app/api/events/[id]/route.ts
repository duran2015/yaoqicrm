import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { assertEventTransition } from "@/lib/event-workflow";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/events/[id] — 会议详情(含参会医生) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await prisma.medEvent.findUnique({
    where: { id },
    include: {
      attendees: {
        include: { hcp: { select: { id: true, name: true, title: true, specialty: true, tier: true, hco: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!event) return err("会议不存在", 404);
  return NextResponse.json(event);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await prisma.medEvent.findUnique({ where: { id } });
  if (!event) return err("会议不存在", 404);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body?.status) return err("status 为必填字段");
  const status = String(body.status);
  try {
    assertEventTransition(event.status, status);
  } catch (error) {
    return err(error instanceof Error ? error.message : "无效状态转换", 409);
  }
  const updated = await prisma.medEvent.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}
