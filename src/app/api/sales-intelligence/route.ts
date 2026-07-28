import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIntelligenceWhere, parseIntelligenceListQuery, shapeIntelligenceItem } from "@/lib/intelligence-query";

export async function GET(req: NextRequest) {
  const filters = parseIntelligenceListQuery(req.nextUrl.searchParams);
  const where = buildIntelligenceWhere(filters);
  const include = {
    products: { include: { product: true } },
    therapeuticAreas: true,
    competitors: { include: { competitor: true } },
  } as const;
  const [records, total] = await Promise.all([
    prisma.salesIntelligence.findMany({
      where,
      include,
      orderBy: [{ priority: "asc" }, { publishedAt: "desc" }, { collectedAt: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.salesIntelligence.count({ where }),
  ]);
  return NextResponse.json({
    items: records.map(shapeIntelligenceItem),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
  });
}
