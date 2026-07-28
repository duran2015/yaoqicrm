export type MaterialInput = {
  productId: string;
  title: string;
  type: "DETAIL_AID" | "SLIDE_DECK" | "PATIENT_EDUCATION" | "CLINICAL_REPRINT";
  messageSummary: string;
  externalUrl: string;
  version: string;
  approvalCode: string | null;
  effectiveDate: Date;
  expiryDate: Date;
};

type AvailableMaterial = {
  id?: string;
  productId?: string;
  status: string;
  approvalCode: string | null;
  externalUrl: string;
  effectiveDate: Date | string;
  expiryDate: Date | string;
};

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["APPROVED", "RETIRED"],
  APPROVED: ["RETIRED"],
  RETIRED: [],
};
const TYPES = new Set(["DETAIL_AID", "SLIDE_DECK", "PATIENT_EDUCATION", "CLINICAL_REPRINT"]);

export function canTransitionMaterial(from: string, to: string) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isMaterialAvailable(material: AvailableMaterial, onDate: Date) {
  return material.status === "APPROVED"
    && Boolean(material.approvalCode?.trim())
    && safeHttpUrl(material.externalUrl)
    && new Date(material.effectiveDate) <= onDate
    && onDate < new Date(material.expiryDate);
}

function required(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function businessDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateMaterialInput(value: unknown): MaterialInput | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const productId = required(item.productId);
  const title = required(item.title);
  const messageSummary = required(item.messageSummary);
  const externalUrl = required(item.externalUrl);
  const version = required(item.version);
  const approvalCode = required(item.approvalCode);
  const effectiveDate = businessDate(item.effectiveDate);
  const expiryDate = businessDate(item.expiryDate);
  if (!productId || !title || !messageSummary || !externalUrl || !version || !effectiveDate || !expiryDate || expiryDate <= effectiveDate || !safeHttpUrl(externalUrl) || typeof item.type !== "string" || !TYPES.has(item.type)) return null;
  return { productId, title, type: item.type as MaterialInput["type"], messageSummary, externalUrl, version, approvalCode, effectiveDate, expiryDate };
}

export function validateMaterialSelection(materials: AvailableMaterial[], selectedProductIds: string[], visitDate: Date) {
  const ids = new Set<string>();
  for (const material of materials) {
    if (!material.id || !material.productId || !selectedProductIds.includes(material.productId) || !isMaterialAvailable(material, visitDate)) return null;
    ids.add(material.id);
  }
  return [...ids];
}
