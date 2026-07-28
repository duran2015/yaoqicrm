import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { POST as createCollectionRun } from "@/app/api/intelligence-collection/runs/route";
import { err } from "@/lib/api";
import { decideMcpOperation, hashAgentPayload, requireAgentConfirmation } from "@/lib/mcp-operation";
import { prisma } from "@/lib/prisma";

const TOOL_NAME = "refresh_product_intelligence";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!employeeId || !productId) return err("employeeId 和 productId 为必填字段");
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) return err("idempotencyKey 长度必须为 8-128 个字符");
  try {
    requireAgentConfirmation(body.confirmed);
  } catch {
    return err("refresh_product_intelligence 必须在用户明确确认后传入 confirmed: true", 409);
  }
  if (!await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })) return err("员工不存在", 404);
  if (!await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })) return err("产品不存在", 404);
  const inputHash = hashAgentPayload({ productId });
  const uniqueWhere = { employeeId_toolName_idempotencyKey: { employeeId, toolName: TOOL_NAME, idempotencyKey } };
  let operation = await prisma.mcpOperation.findUnique({ where: uniqueWhere });
  const decision = decideMcpOperation(operation, inputHash);
  if (decision.action === "REPLAY") return NextResponse.json({ ...JSON.parse(decision.resultJson), replayed: true });
  if (decision.action === "CONFLICT") return err("该 idempotencyKey 已用于不同产品", 409);
  if (decision.action === "IN_PROGRESS") return err("相同采集操作仍在处理中", 409);
  const requestId = randomUUID();
  operation = operation
    ? await prisma.mcpOperation.update({
        where: { id: operation.id },
        data: { status: "IN_PROGRESS", requestId, inputHash, inputSummary: JSON.stringify({ productId }), resultJson: null, errorMessage: null, completedAt: null },
      })
    : await prisma.mcpOperation.create({
        data: { employeeId, toolName: TOOL_NAME, idempotencyKey, requestId, inputHash, inputSummary: JSON.stringify({ productId }) },
      });
  const response = await createCollectionRun(new NextRequest(new URL("/api/intelligence-collection/runs", req.nextUrl.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      triggerType: "PRODUCT_REFRESH",
      productId,
      requestedById: employeeId,
      confirmed: true,
      idempotencyKey,
    }),
  }));
  const payload = await response.json();
  if (!response.ok) {
    await prisma.mcpOperation.update({ where: { id: operation.id }, data: { status: "FAILED", errorMessage: String(payload?.error ?? "采集失败").slice(0, 500), completedAt: new Date() } });
    return NextResponse.json(payload, { status: response.status });
  }
  const result = { operationId: operation.id, requestId, collectionRun: payload, replayed: false };
  await prisma.mcpOperation.update({
    where: { id: operation.id },
    data: { status: "SUCCEEDED", entityType: "CollectionRun", entityId: String(payload.id), resultJson: JSON.stringify(result), completedAt: new Date() },
  });
  return NextResponse.json(result, { status: 201 });
}
