import { prisma } from "./prisma";
import { TIERS } from "./customer";

export class TierChangeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 调整客户分级(HCP/HCO 通用):校验 → 更新 tier → 写 CustomerTierHistory(同一事务)
 */
export async function changeCustomerTier(
  kind: "hcp" | "hco",
  id: string,
  toTier: string,
  changedById: string,
  reason?: string,
) {
  if (!TIERS.includes(toTier as (typeof TIERS)[number])) {
    throw new TierChangeError(400, "toTier 必须为 A | B | C | D");
  }
  if (!changedById) throw new TierChangeError(400, "changedById 为必填字段");
  const changer = await prisma.employee.findUnique({ where: { id: changedById } });
  if (!changer) throw new TierChangeError(404, "changedById 对应的员工不存在");

  const model = kind === "hcp" ? prisma.hcp : prisma.hco;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any = await (model as any).findUnique({ where: { id } });
  if (!existing) throw new TierChangeError(404, kind === "hcp" ? "HCP 不存在" : "HCO 不存在");

  const fromTier: string | null = existing.tier ?? null;
  const idField = kind === "hcp" ? "hcpId" : "hcoId";

  const [updated] = await prisma.$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (model as any).update({ where: { id }, data: { tier: toTier } }),
    prisma.customerTierHistory.create({
      data: { [idField]: id, fromTier, toTier, changedById, reason: reason ?? null },
    }),
  ]);
  return { updated, fromTier };
}
