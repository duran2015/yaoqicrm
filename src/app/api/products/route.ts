import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** GET /api/products?division=&query= — 产品主数据列表 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const division = sp.get("division")?.trim();
  const query = sp.get("query")?.trim();

  const where: Prisma.ProductWhereInput = {};
  if (division) where.division = division;
  if (query) {
    where.OR = [
      { brand: { contains: query } },
      { molecule: { contains: query } },
      { therapeuticCategory: { contains: query } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      sampleLots: { select: { id: true, lotNumber: true, expiryDate: true, totalQty: true } },
      materials: { orderBy: { effectiveDate: "desc" } },
    },
    orderBy: [{ division: "asc" }, { brand: "asc" }],
  });
  return NextResponse.json({ data: products, total: products.length });
}
