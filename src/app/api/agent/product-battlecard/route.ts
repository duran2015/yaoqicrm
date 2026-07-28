import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isMaterialAvailable } from "@/lib/product-material";
import { buildProductBattlecard } from "@/lib/product-battlecard";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (!employeeId || !productId) return err("employeeId 和 productId 为必填参数");
  if (!await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })) return err("员工不存在", 404);
  const asOfValue = req.nextUrl.searchParams.get("asOf");
  const asOf = asOfValue ? new Date(`${asOfValue}T12:00:00+08:00`) : new Date();
  if (Number.isNaN(asOf.getTime())) return err("asOf 必须是 YYYY-MM-DD");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      materials: true,
      intelligenceLinks: {
        where: { intelligence: { verificationStatus: { in: ["VERIFIED", "PENDING_REVIEW"] } } },
        include: { intelligence: true },
      },
    },
  });
  if (!product) return err("产品不存在", 404);
  const intelligence = product.intelligenceLinks.map((link) => ({
    ...link.intelligence,
    publishedAt: link.intelligence.publishedAt?.toISOString() ?? null,
    collectedAt: link.intelligence.collectedAt.toISOString(),
  }));
  return NextResponse.json(buildProductBattlecard({
    product: {
      id: product.id,
      brand: product.brand,
      molecule: product.molecule,
      therapeuticCategory: product.therapeuticCategory,
    },
    intelligence,
    approvedMaterials: product.materials.filter((item) => isMaterialAvailable(item, asOf)).map((item) => ({
      id: item.id,
      title: item.title,
      version: item.version,
      approvalCode: item.approvalCode,
      externalUrl: item.externalUrl,
    })),
  }));
}
