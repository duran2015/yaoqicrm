import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { canTransitionMaterial, validateMaterialInput } from "@/lib/product-material";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const material = await prisma.productMaterial.findUnique({ where: { id } });
  if (!material) return err("资料不存在", 404);
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  if (!canTransitionMaterial(material.status, nextStatus)) return err("资料状态流转不合法", 409);
  if (nextStatus === "APPROVED") {
    const valid = validateMaterialInput({
      ...material,
      effectiveDate: material.effectiveDate.toISOString().slice(0, 10),
      expiryDate: material.expiryDate.toISOString().slice(0, 10),
    });
    if (!valid?.approvalCode) return err("批准资料必须具有批准编号、合法链接和有效期");
  }
  return NextResponse.json(await prisma.productMaterial.update({ where: { id }, data: { status: nextStatus } }));
}
