import { NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { shapeIntelligenceItem } from "@/lib/intelligence-query";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.salesIntelligence.findUnique({
    where: { id },
    include: {
      products: { include: { product: true } },
      therapeuticAreas: true,
      competitors: { include: { competitor: true } },
    },
  });
  if (!record) return err("销售情报不存在", 404);
  return NextResponse.json(shapeIntelligenceItem(record));
}
