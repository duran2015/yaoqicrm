import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { issueMcpToken, requireTokenManager } from "@/lib/mcp-service-token-store";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try { await requireTokenManager(req.nextUrl.searchParams.get("employeeId") ?? ""); }
  catch (e) { return err((e as Error).message, 403); }
  return NextResponse.json(await prisma.mcpServiceToken.findMany({ select: { id: true, name: true, tokenHint: true, status: true, expiresAt: true, lastUsedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }));
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { employeeId?: string; name?: string; expiresAt?: string } | null;
  try { await requireTokenManager(body?.employeeId ?? ""); } catch (e) { return err((e as Error).message, 403); }
  const issued = await issueMcpToken(body?.name?.trim() || "Zerone 客户端演示", body!.employeeId!, body?.expiresAt ? new Date(body.expiresAt) : null);
  return NextResponse.json(issued, { headers: { "Cache-Control": "no-store" } });
}
