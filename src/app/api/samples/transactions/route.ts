import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { calculateInventory } from "@/lib/workflow";
import { signedQuantity } from "@/lib/sample-inventory";

const include = {
  employee: { select: { id: true, name: true } },
  hcp: { select: { id: true, name: true } },
  lot: { include: { product: { select: { id: true, brand: true, molecule: true } } } },
  visit: { select: { id: true, visitDate: true } },
};

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const transactions = await prisma.sampleTransaction.findMany({
    where: { employeeId },
    include,
    orderBy: { transDate: "desc" },
    take: 300,
  });
  return NextResponse.json({ data: transactions, total: transactions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
  const lotId = typeof body.lotId === "string" ? body.lotId : "";
  const type = typeof body.type === "string" ? body.type : "";
  const quantity = Number(body.quantity);
  if (!employeeId || !lotId) return err("employeeId 和 lotId 为必填字段");
  if (!["RECEIVE", "RETURN", "ADJUST"].includes(type)) return err("type 必须为 RECEIVE | RETURN | ADJUST");
  try {
    signedQuantity(type, quantity);
  } catch (error) {
    return err(error instanceof Error ? error.message : "数量无效");
  }
  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const [employee, lot, existing] = await Promise.all([
        tx.employee.findUnique({ where: { id: employeeId } }),
        tx.sampleLot.findUnique({ where: { id: lotId } }),
        tx.sampleTransaction.findMany({
          where: { employeeId, lotId },
          select: { type: true, quantity: true },
        }),
      ]);
      if (!employee || !lot) throw new Error("NOT_FOUND");
      const current = calculateInventory(existing);
      const projected = current + signedQuantity(type, quantity);
      if (projected < 0) throw new Error(`NEGATIVE:${current}`);
      return tx.sampleTransaction.create({
        data: {
          employeeId, lotId, type, quantity,
          reason: body.reason ? String(body.reason) : null,
        },
        include,
      });
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return err("员工或样品批次不存在", 404);
    if (error instanceof Error && error.message.startsWith("NEGATIVE:")) {
      return err(`库存不足，当前批次库存 ${error.message.split(":")[1]} 盒`, 409);
    }
    throw error;
  }
}
