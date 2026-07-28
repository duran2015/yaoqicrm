import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { POST as createVisit } from "@/app/api/visits/route";
import { err } from "@/lib/api";
import {
  decideMcpOperation,
  hashAgentPayload,
  requireAgentConfirmation,
} from "@/lib/mcp-operation";
import { prisma } from "@/lib/prisma";

const TOOL_NAME = "complete_hcp_visit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return err("请求体不是合法 JSON");
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const requestId = typeof body.requestId === "string" && body.requestId.trim()
    ? body.requestId.trim()
    : randomUUID();
  const visitInput = body.visit && typeof body.visit === "object" && !Array.isArray(body.visit)
    ? body.visit as Record<string, unknown>
    : null;
  if (!employeeId) return err("employeeId 为必填字段");
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return err("idempotencyKey 长度必须为 8-128 个字符");
  }
  try {
    requireAgentConfirmation(body.confirmed);
  } catch (error) {
    return err((error as Error).message, 409);
  }
  if (!visitInput || typeof visitInput.hcpId !== "string" || !visitInput.hcpId.trim()) {
    return err("visit.hcpId 为必填字段");
  }
  if (!await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })) {
    return err("员工不存在", 404);
  }

  const inputHash = hashAgentPayload(visitInput);
  const uniqueWhere = {
    employeeId_toolName_idempotencyKey: { employeeId, toolName: TOOL_NAME, idempotencyKey },
  };
  let operation = await prisma.mcpOperation.findUnique({ where: uniqueWhere });
  let decision = decideMcpOperation(operation, inputHash);
  if (decision.action === "REPLAY") {
    return NextResponse.json({ ...JSON.parse(decision.resultJson), replayed: true });
  }
  if (decision.action === "CONFLICT") return err("该 idempotencyKey 已用于不同的拜访内容", 409);
  if (decision.action === "IN_PROGRESS") return err("相同写操作仍在处理中，请稍后使用原幂等键重试", 409);

  const inputSummary = JSON.stringify({
    hcpId: visitInput.hcpId,
    type: visitInput.type ?? "FACE_TO_FACE",
    productCount: Array.isArray(visitInput.products) ? visitInput.products.length : 0,
    materialCount: Array.isArray(visitInput.materialIds) ? visitInput.materialIds.length : 0,
    sampleCount: Array.isArray(visitInput.samples) ? visitInput.samples.length : 0,
    hasFollowUp: Boolean(visitInput.followUp),
  });
  if (operation) {
    operation = await prisma.mcpOperation.update({
      where: { id: operation.id },
      data: {
        status: "IN_PROGRESS",
        requestId,
        inputHash,
        inputSummary,
        resultJson: null,
        errorMessage: null,
        completedAt: null,
      },
    });
  } else {
    try {
      operation = await prisma.mcpOperation.create({
        data: {
          employeeId,
          toolName: TOOL_NAME,
          idempotencyKey,
          requestId,
          inputHash,
          inputSummary,
        },
      });
    } catch (cause) {
      if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || cause.code !== "P2002") throw cause;
      operation = await prisma.mcpOperation.findUnique({ where: uniqueWhere });
      decision = decideMcpOperation(operation, inputHash);
      if (decision.action === "REPLAY") {
        return NextResponse.json({ ...JSON.parse(decision.resultJson), replayed: true });
      }
      return err(
        decision.action === "CONFLICT"
          ? "该 idempotencyKey 已用于不同的拜访内容"
          : "相同写操作仍在处理中，请稍后使用原幂等键重试",
        409,
      );
    }
  }

  const visitResponse = await createVisit(new NextRequest(new URL("/api/visits", req.nextUrl.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...visitInput, employeeId, source: "AI" }),
  }));
  const visitResult = await visitResponse.json();
  if (!visitResponse.ok) {
    await prisma.mcpOperation.update({
      where: { id: operation!.id },
      data: {
        status: "FAILED",
        errorMessage: typeof visitResult?.error === "string" ? visitResult.error.slice(0, 500) : "CRM 写入失败",
        completedAt: new Date(),
      },
    });
    return NextResponse.json(visitResult, { status: visitResponse.status });
  }

  const result = {
    operationId: operation!.id,
    requestId,
    visit: visitResult,
    replayed: false,
  };
  await prisma.mcpOperation.update({
    where: { id: operation!.id },
    data: {
      status: "SUCCEEDED",
      entityType: "Visit",
      entityId: String(visitResult.id),
      resultJson: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
  return NextResponse.json(result, { status: 201 });
}
