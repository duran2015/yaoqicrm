import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { isMaterialAvailable, validateMaterialInput } from "@/lib/product-material";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId")?.trim();
  if (!productId) return err("productId 为必填字段");
  const availableOn = req.nextUrl.searchParams.get("availableOn");
  const materials = await prisma.productMaterial.findMany({ where: { productId }, orderBy: [{ status: "asc" }, { effectiveDate: "desc" }] });
  if (!availableOn) return NextResponse.json(materials);
  const date = new Date(`${availableOn}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return err("availableOn 必须是 YYYY-MM-DD");
  return NextResponse.json(materials.filter((item) => isMaterialAvailable(item, date)));
}

export async function POST(req: NextRequest) {
  const input = validateMaterialInput(await req.json().catch(() => null));
  if (!input) return err("资料字段、类型、链接或有效期不合法");
  if (!await prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } })) return err("产品不存在", 404);
  try {
    return NextResponse.json(await prisma.productMaterial.create({ data: { ...input, status: "DRAFT" } }), { status: 201 });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") return err("该产品版本号已存在", 409);
    throw cause;
  }
}
