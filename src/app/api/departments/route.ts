import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type DeptNode = {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  employeeCount: number;
  children: DeptNode[];
};

/**
 * GET /api/departments — 五级部门树(嵌套 children)
 * level: 1=事业部 2=战区 3=分管区 4=区 5=办事处
 */
export async function GET() {
  const departments = await prisma.department.findMany({
    include: { _count: { select: { employees: true } } },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  const nodes = new Map<string, DeptNode>();
  for (const d of departments) {
    nodes.set(d.id, {
      id: d.id,
      name: d.name,
      level: d.level,
      parentId: d.parentId,
      employeeCount: d._count.employees,
      children: [],
    });
  }
  const roots: DeptNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return NextResponse.json({ data: roots, total: departments.length });
}
