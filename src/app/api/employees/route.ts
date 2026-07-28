import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EmployeeNode = {
  id: string;
  employeeCode: string;
  name: string;
  role: string;
  division: string;
  phone: string | null;
  reportsToId: string | null;
  territory: { id: string; name: string; level: string } | null;
  department: { id: string; name: string; level: number } | null;
  /** 部门全路径,如 "综合创新产品事业部 / 中部战区A / 苏皖分管区A / 苏南区A / 苏州办事处A" */
  departmentPath: string | null;
  subordinates: EmployeeNode[];
};

/** GET /api/employees — 完整组织树(嵌套 subordinates),含工号与部门路径 */
export async function GET() {
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      include: {
        territory: { select: { id: true, name: true, level: true } },
        department: { select: { id: true, name: true, level: true, parentId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  // 部门 id → 节点,用于向上拼全路径
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const deptPath = (deptId: string | null | undefined): string | null => {
    if (!deptId) return null;
    const names: string[] = [];
    let cur = deptMap.get(deptId);
    let guard = 0;
    while (cur && guard++ < 10) {
      names.unshift(cur.name);
      cur = cur.parentId ? deptMap.get(cur.parentId) : undefined;
    }
    return names.length ? names.join(" / ") : null;
  };

  const nodes = new Map<string, EmployeeNode>();
  for (const e of employees) {
    nodes.set(e.id, {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      role: e.role,
      division: e.division,
      phone: e.phone,
      reportsToId: e.reportsToId,
      territory: e.territory,
      department: e.department ? { id: e.department.id, name: e.department.name, level: e.department.level } : null,
      departmentPath: deptPath(e.departmentId),
      subordinates: [],
    });
  }
  const roots: EmployeeNode[] = [];
  for (const node of nodes.values()) {
    if (node.reportsToId && nodes.has(node.reportsToId)) {
      nodes.get(node.reportsToId)!.subordinates.push(node);
    } else {
      roots.push(node);
    }
  }
  return NextResponse.json({ data: roots, total: employees.length });
}
