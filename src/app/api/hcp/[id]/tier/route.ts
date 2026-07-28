import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { changeCustomerTier, TierChangeError } from "@/lib/tier";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/hcp/[id]/tier — 调整医生分级 { toTier: A|B|C|D, changedById, reason? } */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("请求体不是合法 JSON");
  }
  try {
    const { updated, fromTier } = await changeCustomerTier(
      "hcp",
      id,
      String(body.toTier ?? ""),
      String(body.changedById ?? ""),
      body.reason ? String(body.reason) : undefined,
    );
    return NextResponse.json({ ...updated, fromTier });
  } catch (e) {
    if (e instanceof TierChangeError) return err(e.message, e.status);
    throw e;
  }
}
