import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json(await prisma.salesImportBatch.findMany({ include: { importedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 10 }));
}
