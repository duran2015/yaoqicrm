import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** GET /api/samples/lots?productId= — 样品批次列表(含已发放/已领用汇总) */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  const where: Prisma.SampleLotWhereInput = productId ? { productId } : {};

  const lots = await prisma.sampleLot.findMany({
    where,
    include: {
      product: { select: { id: true, brand: true, molecule: true, unit: true } },
      transactions: { select: { quantity: true, type: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  const data = lots.map((l) => {
    const received = l.transactions.filter((t) => t.type === "RECEIVE").reduce((s, t) => s + t.quantity, 0);
    const distributed = l.transactions.filter((t) => t.type === "DISTRIBUTE").reduce((s, t) => s + t.quantity, 0);
    const { transactions: _txns, ...rest } = l;
    void _txns;
    return { ...rest, received, distributed, remaining: l.totalQty - received };
  });
  return NextResponse.json({ data, total: data.length });
}
