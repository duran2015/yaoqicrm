export type AffiliationInput = {
  hcoId: string;
  departmentName: string;
  title: string | null;
  adminDuty: string | null;
  isPrimary: boolean;
  effectiveDate: Date;
  endDate: Date | null;
};

export type AffiliationInterval = {
  effectiveDate: Date | string;
  endDate: Date | string | null;
};

type PrimaryCandidate = AffiliationInterval & {
  id: string;
  createdAt: Date | string;
};

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function businessDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseAffiliationInput(value: unknown): AffiliationInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const hcoId = requiredString(candidate.hcoId);
  const departmentName = requiredString(candidate.departmentName);
  const effectiveDate = businessDate(candidate.effectiveDate);
  const endDate = candidate.endDate === null || candidate.endDate === "" || candidate.endDate === undefined
    ? null
    : businessDate(candidate.endDate);
  if (!hcoId || !departmentName || !effectiveDate || (candidate.endDate && !endDate) || (endDate && endDate <= effectiveDate)) return null;
  return {
    hcoId,
    departmentName,
    title: optionalString(candidate.title),
    adminDuty: optionalString(candidate.adminDuty),
    isPrimary: candidate.isPrimary === true,
    effectiveDate,
    endDate,
  };
}

export function isCurrentAffiliation(affiliation: AffiliationInterval, asOf: Date) {
  const effectiveDate = new Date(affiliation.effectiveDate);
  const endDate = affiliation.endDate ? new Date(affiliation.endDate) : null;
  return effectiveDate <= asOf && (!endDate || asOf < endDate);
}

export function choosePrimaryAffiliation<T extends PrimaryCandidate>(affiliations: T[], asOf: Date): T | null {
  return affiliations
    .filter((item) => isCurrentAffiliation(item, asOf))
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      || b.id.localeCompare(a.id))[0] ?? null;
}
