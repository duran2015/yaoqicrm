import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

/**
 * GET /api/evaluations/pending?evaluatorId=xx(必填)
 * 我的待评定收件箱:接收人是我(receiverId = evaluatorId)且 validityStatus = PENDING 的拜访,
 * 含填写人 / 医生 / 医院 / 时间 / 结构化目的 / 人工总结 / 签到。
 */
export async function GET(req: NextRequest) {
  const evaluatorId = req.nextUrl.searchParams.get("evaluatorId")?.trim();
  if (!evaluatorId) return err("evaluatorId 为必填参数");
  const evaluator = await prisma.employee.findUnique({ where: { id: evaluatorId } });
  if (!evaluator) return err("evaluatorId 对应的员工不存在", 404);

  const visits = await prisma.visit.findMany({
    where: { receiverId: evaluatorId, validityStatus: "PENDING" },
    include: {
      employee: { select: { id: true, name: true, role: true, division: true } },
      hcp: { select: { id: true, code: true, name: true, title: true, specialty: true, tier: true } },
      hco: { select: { id: true, code: true, name: true, type: true, level: true } },
      checkins: { orderBy: { checkinTime: "asc" } },
    },
    orderBy: { visitDate: "desc" },
    take: 500,
  });
  return NextResponse.json({ data: visits, total: visits.length });
}
