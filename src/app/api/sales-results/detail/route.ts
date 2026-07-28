import { NextRequest, NextResponse } from "next/server";
import { collectSubtreeIds, err } from "@/lib/api";
import { getSalesDetail, type SalesDimension } from "@/lib/sales-results-data";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const dimension = req.nextUrl.searchParams.get("dimension");
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (dimension !== "product" && dimension !== "hco" && dimension !== "employee") return err("dimension 不合法");
  if (!id) return err("id 为必填字段");
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const managerId = req.nextUrl.searchParams.get("managerId");
  try {
    const employeeIds = managerId ? await collectSubtreeIds(managerId) : employeeId ? [employeeId] : undefined;
    const detail = await getSalesDetail({ month, dimension: dimension as SalesDimension, id, employeeIds });
    return detail ? NextResponse.json(detail) : err("未找到销售结果", 404);
  } catch (cause) {
    return err(cause instanceof Error ? cause.message : "销售结果详情失败");
  }
}
