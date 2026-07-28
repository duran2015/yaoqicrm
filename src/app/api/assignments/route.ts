import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";
import { assignmentInclude } from "@/lib/customer";

/**
 * POST /api/assignments — 客户-代表分配
 * body: { hcpId | hcoId(二选一), employeeId, role?: OWNER|COLLAB(默认 OWNER) }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  const hcpId = body.hcpId ? String(body.hcpId) : null;
  const hcoId = body.hcoId ? String(body.hcoId) : null;
  const employeeId = body.employeeId ? String(body.employeeId) : "";
  const role = body.role ? String(body.role) : "OWNER";

  if ((hcpId ? 1 : 0) + (hcoId ? 1 : 0) !== 1) return err("hcpId 与 hcoId 必须二选一");
  if (!employeeId) return err("employeeId 为必填字段");
  if (!["OWNER", "COLLAB"].includes(role)) return err("role 必须为 OWNER | COLLAB");

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return err("employeeId 对应的员工不存在", 404);
  if (hcpId) {
    const hcp = await prisma.hcp.findUnique({ where: { id: hcpId } });
    if (!hcp) return err("hcpId 对应的医生不存在", 404);
  }
  if (hcoId) {
    const hco = await prisma.hco.findUnique({ where: { id: hcoId } });
    if (!hco) return err("hcoId 对应的机构不存在", 404);
  }

  const dup = await prisma.customerAssignment.findFirst({
    where: { hcpId, hcoId, employeeId, role },
  });
  if (dup) return err("该分配关系已存在,不能重复分配", 409);

  const assignment = await prisma.customerAssignment.create({
    data: { hcpId, hcoId, employeeId, role },
    ...assignmentInclude,
  });
  return NextResponse.json(assignment, { status: 201 });
}
