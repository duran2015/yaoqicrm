import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api"; import { requireTokenManager } from "@/lib/mcp-service-token-store"; import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json().catch(() => null) as { employeeId?: string } | null;
  try { await requireTokenManager(body?.employeeId ?? ""); } catch (e) { return err((e as Error).message, 403); }
  const { id } = await params; return NextResponse.json(await prisma.mcpServiceToken.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date(), revokedByEmployeeId: body!.employeeId } }));
}
