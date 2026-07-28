import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

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
