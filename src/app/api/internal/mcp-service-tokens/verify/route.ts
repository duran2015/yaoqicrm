import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api"; import { hashMcpServiceToken, verifyMcpServiceCredential } from "@/lib/mcp-service-token"; import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest) {
  if (!process.env.MCP_INTERNAL_AUTH_SECRET || req.headers.get("x-mcp-internal-secret") !== process.env.MCP_INTERNAL_AUTH_SECRET) return err("内部鉴权失败", 403);
  const { token } = await req.json().catch(() => ({ token: "" }));
  const record = await prisma.mcpServiceToken.findUnique({ where: { tokenHash: hashMcpServiceToken(String(token)) } });
  if (!record || !verifyMcpServiceCredential(String(token), record)) return err("MCP Token 无效、过期或已撤销", 401);
  const employee = await prisma.employee.findUnique({ where: { id: record.employeeId } }); if (!employee) return err("服务身份不存在", 401);
  await prisma.mcpServiceToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date(), lastUsedIp: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null } });
  return NextResponse.json({ tokenId: record.id, actor: { userId: `mcp-service:${record.id}`, employeeId: employee.id, employeeName: employee.name, role: employee.role, division: employee.division, departmentId: employee.departmentId } }, { headers: { "Cache-Control": "no-store" } });
}
