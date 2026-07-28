import { NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canTransitionIntelligence, validateIntelligenceReview } from "@/lib/sales-intelligence";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = validateIntelligenceReview(await req.json().catch(() => null));
  if (!input) return err("核验状态或说明不合法");
  const current = await prisma.salesIntelligence.findUnique({ where: { id }, select: { verificationStatus: true } });
  if (!current) return err("销售情报不存在", 404);
  if (!canTransitionIntelligence(current.verificationStatus, input.status)) return err("情报状态流转不合法", 409);
  return NextResponse.json(await prisma.salesIntelligence.update({
    where: { id },
    data: {
      verificationStatus: input.status,
      reviewNote: input.reviewNote ?? null,
      reviewedAt: new Date(),
    },
  }));
}
