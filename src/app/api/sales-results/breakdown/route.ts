import { NextRequest, NextResponse } from "next/server";
import { collectSubtreeIds, err } from "@/lib/api";
import { getSalesBreakdown, type SalesDimension } from "@/lib/sales-results-data";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const dimension = req.nextUrl.searchParams.get("dimension");
  if (dimension !== "product" && dimension !== "hco" && dimension !== "employee") return err("dimension 不合法");
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const managerId = req.nextUrl.searchParams.get("managerId");
  try {
    const employeeIds = managerId ? await collectSubtreeIds(managerId) : employeeId ? [employeeId] : undefined;
    return NextResponse.json(await getSalesBreakdown({ month, dimension: dimension as SalesDimension, employeeIds }));
  } catch (cause) {
    return err(cause instanceof Error ? cause.message : "销售结果下钻失败");
  }
}
