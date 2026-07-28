import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { shapeIntelligenceItem } from "@/lib/intelligence-query";
import { INTELLIGENCE_TYPES } from "@/lib/sales-intelligence";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const query = req.nextUrl.searchParams.get("query")?.trim();
  if (!employeeId || !query) return err("employeeId 和 query 为必填参数");
  if (!await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })) return err("员工不存在", 404);
  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  const includePending = req.nextUrl.searchParams.get("includePending") === "true";
  const requestedTypes = (req.nextUrl.searchParams.get("types") ?? "").split(",")
    .map((item) => item.trim())
    .filter((item) => INTELLIGENCE_TYPES.includes(item as never));
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 10, 1), 20);
  const items = await prisma.salesIntelligence.findMany({
    where: {
      verificationStatus: includePending ? { in: ["VERIFIED", "PENDING_REVIEW"] } : "VERIFIED",
      ...(requestedTypes.length ? { type: { in: requestedTypes } } : {}),
      ...(productId ? { products: { some: { productId } } } : {}),
      OR: [
        { title: { contains: query } },
        { summary: { contains: query } },
        { contentExcerpt: { contains: query } },
        { products: { some: { product: { OR: [{ brand: { contains: query } }, { molecule: { contains: query } }] } } } },
      ],
    },
    include: {
      products: { include: { product: true } },
      therapeuticAreas: true,
      competitors: { include: { competitor: true } },
    },
    orderBy: [{ verificationStatus: "desc" }, { priority: "asc" }, { publishedAt: "desc" }],
    take: limit,
  });
  const shaped = items.map(shapeIntelligenceItem);
  return NextResponse.json({
    querySummary: { query, productId: productId ?? null, types: requestedTypes, includePending, limit },
    items: shaped,
    citations: shaped.map((item) => ({
      intelligenceId: item.id,
      title: item.title,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      verificationStatus: item.verificationStatus,
    })),
    warnings: includePending && shaped.some((item) => item.verificationStatus === "PENDING_REVIEW")
      ? ["结果包含待核验线索，不能作为确定性结论或批准话术"]
      : [],
  });
}
