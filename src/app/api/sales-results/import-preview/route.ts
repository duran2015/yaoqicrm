import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { previewSalesImport } from "@/lib/sales-import";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return err("请选择 CSV 文件");
  return NextResponse.json(await previewSalesImport(await file.text()));
}
