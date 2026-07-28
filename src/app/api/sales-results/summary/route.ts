import { NextRequest, NextResponse } from "next/server";
import { collectSubtreeIds, err } from "@/lib/api";
import { getSalesSummary } from "@/lib/sales-results-data";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  const managerId = req.nextUrl.searchParams.get("managerId");
  try {
    const employeeIds = managerId ? await collectSubtreeIds(managerId) : employeeId ? [employeeId] : undefined;
    return NextResponse.json(await getSalesSummary({ month, employeeIds }));
  } catch (cause) {
    return err(cause instanceof Error ? cause.message : "销售结果汇总失败");
  }
}
