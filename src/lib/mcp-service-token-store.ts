import { prisma } from "./prisma";
import { createMcpServiceCredential, mcpClientConfig } from "./mcp-service-token";

export async function serviceAdmin() {
  return prisma.employee.upsert({
    where: { employeeCode: "MCP-DEMO-ADMIN" },
    update: { role: "ADMIN" },
    create: { employeeCode: "MCP-DEMO-ADMIN", name: "MCP 演示管理员", role: "ADMIN", division: "演示环境" },
  });
}

export async function issueMcpToken(name: string, creatorId: string, expiresAt: Date | null = null) {
  const actor = await serviceAdmin(); const credential = createMcpServiceCredential();
  const record = await prisma.mcpServiceToken.create({ data: { name, tokenHash: credential.tokenHash, tokenHint: credential.tokenHint, employeeId: actor.id, createdByEmployeeId: creatorId, expiresAt } });
  return { record, token: credential.token, config: mcpClientConfig(credential.token, process.env.MCP_PUBLIC_URL ?? "http://47.116.206.152/pharma-mcp") };
}

export async function requireTokenManager(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !["ADMIN", "RSM", "ASM"].includes(employee.role)) throw new Error("只有管理岗可以管理 MCP Token");
  return employee;
}
