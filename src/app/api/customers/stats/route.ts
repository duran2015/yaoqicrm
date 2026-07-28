import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

/**
 * GET /api/customers/stats?type=hcp|hco&employeeId= — 客户分级统计卡
 * 返回 { total, mine, ungraded, tierA, tierB, tierC, tierD }
 * mine:该员工有分配关系(OWNER/COLLAB)的客户数;不传 employeeId 时为 0
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type")?.trim();
  const employeeId = sp.get("employeeId")?.trim();
  if (type !== "hcp" && type !== "hco") return err("type 必须为 hcp | hco");

  const [total, ungraded, tierA, tierB, tierC, tierD, mine] =
    type === "hcp"
      ? await Promise.all([
          prisma.hcp.count(),
          prisma.hcp.count({ where: { tier: null } }),
          prisma.hcp.count({ where: { tier: "A" } }),
          prisma.hcp.count({ where: { tier: "B" } }),
          prisma.hcp.count({ where: { tier: "C" } }),
          prisma.hcp.count({ where: { tier: "D" } }),
          employeeId
            ? prisma.hcp.count({ where: { assignments: { some: { employeeId } } } })
            : Promise.resolve(0),
        ])
      : await Promise.all([
          prisma.hco.count(),
          prisma.hco.count({ where: { tier: null } }),
          prisma.hco.count({ where: { tier: "A" } }),
          prisma.hco.count({ where: { tier: "B" } }),
          prisma.hco.count({ where: { tier: "C" } }),
          prisma.hco.count({ where: { tier: "D" } }),
          employeeId
            ? prisma.hco.count({ where: { assignments: { some: { employeeId } } } })
            : Promise.resolve(0),
        ]);
  return NextResponse.json({ total, mine, ungraded, tierA, tierB, tierC, tierD });
}
