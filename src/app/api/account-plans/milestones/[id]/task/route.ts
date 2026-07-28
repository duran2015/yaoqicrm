import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const milestone = await prisma.accountMilestone.findUnique({
    where: { id },
    include: { accountPlan: { include: { hco: { select: { id: true, name: true } } } } },
  });
  if (!milestone) return err("里程碑不存在", 404);
  if (milestone.accountPlan.status !== "ACTIVE" || milestone.status !== "OPEN") return err("只有活动计划的开放里程碑可以转为任务", 409);
  if (milestone.followUpTaskId) return err("该里程碑已经生成过任务", 409);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.followUpTask.create({
      data: {
        title: milestone.title,
        description: [milestone.description, `来源：${milestone.accountPlan.hco.name} Account Plan`].filter(Boolean).join("\n"),
        assigneeId: milestone.ownerId,
        hcoId: milestone.accountPlan.hcoId,
        dueDate: milestone.dueDate,
        priority: "HIGH",
      },
    });
    await tx.accountMilestone.update({ where: { id }, data: { followUpTaskId: created.id } });
    return created;
  });
  return NextResponse.json(task, { status: 201 });
}
