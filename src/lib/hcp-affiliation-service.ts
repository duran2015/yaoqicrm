import { Prisma, PrismaClient } from "@prisma/client";
import {
  type AffiliationInput,
  choosePrimaryAffiliation,
  isCurrentAffiliation,
} from "./hcp-affiliation";
import { prisma } from "./prisma";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function reconcilePrimaryAffiliation(
  tx: TransactionClient,
  hcpId: string,
  preferredId: string | null,
  asOf: Date,
) {
  const affiliations = await tx.hcpAffiliation.findMany({ where: { hcpId } });
  const preferred = preferredId
    ? affiliations.find((item) => item.id === preferredId && isCurrentAffiliation(item, asOf))
    : null;
  const existing = affiliations.find((item) => item.isPrimary && isCurrentAffiliation(item, asOf));
  const primary = preferred ?? existing ?? choosePrimaryAffiliation(affiliations, asOf);

  await tx.hcpAffiliation.updateMany({
    where: { hcpId, isPrimary: true, ...(primary ? { id: { not: primary.id } } : {}) },
    data: { isPrimary: false },
  });
  if (primary && !primary.isPrimary) {
    await tx.hcpAffiliation.update({ where: { id: primary.id }, data: { isPrimary: true } });
  }

  await tx.hcp.update({
    where: { id: hcpId },
    data: primary
      ? {
          hcoId: primary.hcoId,
          specialty: primary.departmentName,
          title: primary.title,
          adminDuty: primary.adminDuty,
        }
      : { hcoId: null, specialty: null, title: null, adminDuty: null },
  });
}

export async function createHcpAffiliation(hcpId: string, input: AffiliationInput, asOf = new Date()) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.hcpAffiliation.create({
      data: { ...input, hcpId, isPrimary: false },
    });
    const currentCount = await tx.hcpAffiliation.count({
      where: {
        hcpId,
        effectiveDate: { lte: asOf },
        OR: [{ endDate: null }, { endDate: { gt: asOf } }],
      },
    });
    if (input.isPrimary && !isCurrentAffiliation(created, asOf)) {
      throw new Error("PRIMARY_AFFILIATION_NOT_CURRENT");
    }
    const preferredId = input.isPrimary || currentCount === 1 ? created.id : null;
    await reconcilePrimaryAffiliation(tx, hcpId, preferredId, asOf);
    return tx.hcpAffiliation.findUniqueOrThrow({
      where: { id: created.id },
      include: { hco: { select: { id: true, code: true, name: true, type: true, level: true } } },
    });
  });
}

export async function updateHcpAffiliation(
  hcpId: string,
  affiliationId: string,
  input: AffiliationInput,
  asOf = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.hcpAffiliation.findFirst({ where: { id: affiliationId, hcpId } });
    if (!existing) throw new Error("AFFILIATION_NOT_FOUND");
    if (input.isPrimary && !isCurrentAffiliation(input, asOf)) {
      throw new Error("PRIMARY_AFFILIATION_NOT_CURRENT");
    }
    await tx.hcpAffiliation.update({
      where: { id: affiliationId },
      data: {
        hcoId: input.hcoId,
        departmentName: input.departmentName,
        title: input.title,
        adminDuty: input.adminDuty,
        effectiveDate: input.effectiveDate,
        endDate: input.endDate,
        isPrimary: existing.isPrimary,
      },
    });
    const remainsCurrent = isCurrentAffiliation(input, asOf);
    await reconcilePrimaryAffiliation(
      tx,
      hcpId,
      input.isPrimary || (existing.isPrimary && remainsCurrent) ? affiliationId : null,
      asOf,
    );
    return tx.hcpAffiliation.findUniqueOrThrow({
      where: { id: affiliationId },
      include: { hco: { select: { id: true, code: true, name: true, type: true, level: true } } },
    });
  });
}

export function isAffiliationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
