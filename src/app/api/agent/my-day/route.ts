import { NextRequest, NextResponse } from "next/server";
import { GET as getDashboard } from "@/app/api/analytics/dashboard/route";
import { GET as getWorkbench } from "@/app/api/representative/workbench/route";
import { err } from "@/lib/api";
import { buildMyDay } from "@/lib/agent-demo";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  if (!employeeId) return err("employeeId 为必填参数");
  const asOf = req.nextUrl.searchParams.get("asOf")?.trim() || new Date().toISOString().slice(0, 10);
  const representative = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, employeeCode: true, role: true, division: true },
  });
  if (!representative) return err("员工不存在", 404);
  if (representative.role !== "MR") return err("我的今日工作仅支持医药代表", 409);

  const query = new URLSearchParams({ employeeId, asOf });
  const [workbenchResponse, dashboardResponse] = await Promise.all([
    getWorkbench(new NextRequest(new URL(`/api/representative/workbench?${query}`, req.nextUrl.origin))),
    getDashboard(new NextRequest(new URL(`/api/analytics/dashboard?${query}`, req.nextUrl.origin))),
  ]);
  if (!workbenchResponse.ok) {
    return NextResponse.json(await workbenchResponse.json(), { status: workbenchResponse.status });
  }
  if (!dashboardResponse.ok) {
    return NextResponse.json(await dashboardResponse.json(), { status: dashboardResponse.status });
  }
  const workbench = await workbenchResponse.json();
  const dashboard = await dashboardResponse.json();
  return NextResponse.json(buildMyDay(representative, workbench, dashboard, workbench.asOf));
}

