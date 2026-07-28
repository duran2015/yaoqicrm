import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, parseDate } from "@/lib/api";
import { canEditPlan } from "@/lib/tour-plan";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const plan = await prisma.tourPlan.findUnique({ where: { id } });
  if (!plan) return err("周计划不存在", 404);
  if (!canEditPlan(plan.status)) return err("当前状态的周计划不能编辑", 409);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const rawItems = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
  const items: Array<{ planDate: Date; hcpId?: string; hcoName?: string; note?: string }> = [];
  for (const item of rawItems) {
    const planDate = parseDate(typeof item.planDate === "string" ? item.planDate : null);
    if (!planDate) return err("items[].planDate 必须是合法日期");
    if (item.hcpId) {
      const hcp = await prisma.hcp.findUnique({ where: { id: String(item.hcpId) } });
      if (!hcp) return err("计划中的医生不存在", 404);
    }
    items.push({
      planDate,
      hcpId: item.hcpId ? String(item.hcpId) : undefined,
      hcoName: item.hcoName ? String(item.hcoName) : undefined,
      note: item.note ? String(item.note) : undefined,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.tourPlanItem.deleteMany({ where: { tourPlanId: id } });
    return tx.tourPlan.update({
      where: { id },
      data: {
        status: "DRAFT",
        rejectReason: null,
        items: { create: items },
      },
      include: {
        employee: { select: { id: true, name: true, role: true, division: true } },
        items: {
          orderBy: { planDate: "asc" },
          include: { hcp: { include: { hco: true } } },
        },
      },
    });
  });
  return NextResponse.json(updated);
}
