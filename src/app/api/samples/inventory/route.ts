import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { signedQuantity } from "@/lib/sample-inventory";

/**
 * GET /api/samples/inventory?employeeId= — 代表样品库存
 * 按产品聚合:领用总量(RECEIVE)- 发放总量(DISTRIBUTE)= 当前库存,含批次明细
 */
export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return err("员工不存在", 404);

  const txns = await prisma.sampleTransaction.findMany({
    where: { employeeId },
    include: { lot: { include: { product: { select: { id: true, brand: true, molecule: true, unit: true } } } } },
    orderBy: { transDate: "desc" },
  });

  type LotAgg = { lotId: string; lotNumber: string; expiryDate: Date; received: number; distributed: number; current: number };
  type ProductAgg = {
    product: { id: string; brand: string; molecule: string; unit: string | null };
    received: number;
    distributed: number;
    current: number;
    lots: LotAgg[];
  };
  const byProduct = new Map<string, ProductAgg>();

  for (const t of txns) {
    const p = t.lot.product;
    let prod = byProduct.get(p.id);
    if (!prod) {
      prod = { product: p, received: 0, distributed: 0, current: 0, lots: [] };
      byProduct.set(p.id, prod);
    }
    let lot = prod.lots.find((l) => l.lotId === t.lotId);
    if (!lot) {
      lot = { lotId: t.lotId, lotNumber: t.lot.lotNumber, expiryDate: t.lot.expiryDate, received: 0, distributed: 0, current: 0 };
      prod.lots.push(lot);
    }
    if (t.type === "RECEIVE") {
      prod.received += t.quantity;
      lot.received += t.quantity;
    } else if (t.type === "DISTRIBUTE") {
      prod.distributed += t.quantity;
      lot.distributed += t.quantity;
    }
    const effect = signedQuantity(t.type, t.quantity);
    prod.current += effect;
    lot.current += effect;
  }

  return NextResponse.json({
    employee: { id: employee.id, name: employee.name, role: employee.role },
    data: [...byProduct.values()],
  });
}
