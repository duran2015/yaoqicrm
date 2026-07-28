import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { confirmSalesImport, type NormalizedSalesRow } from "@/lib/sales-import";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.rows)) return err("rows 必须是数组");
    return NextResponse.json(await confirmSalesImport(String(body.fileName ?? ""), String(body.importedById ?? ""), body.rows as NormalizedSalesRow[]), { status: 201 });
  } catch (cause) {
    return err(cause instanceof Error ? cause.message : "导入失败", 409);
  }
}
