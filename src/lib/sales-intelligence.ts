export const INTELLIGENCE_TYPES = [
  "POLICY",
  "COMPETITOR",
  "INDUSTRY_NEWS",
  "DISEASE_KNOWLEDGE",
  "PRODUCT_KNOWLEDGE",
] as const;

export const VERIFICATION_STATUSES = [
  "PENDING_REVIEW",
  "VERIFIED",
  "REJECTED",
  "ARCHIVED",
] as const;

export const INTELLIGENCE_CONFIDENCES = ["HIGH", "MEDIUM", "LOW"] as const;
export const INTELLIGENCE_PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;

export type IntelligenceType = typeof INTELLIGENCE_TYPES[number];
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];
export type IntelligenceConfidence = typeof INTELLIGENCE_CONFIDENCES[number];
export type IntelligencePriority = typeof INTELLIGENCE_PRIORITIES[number];

type IntelligenceValidity = {
  verificationStatus: string;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
};

const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  PENDING_REVIEW: ["VERIFIED", "REJECTED", "ARCHIVED"],
  VERIFIED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionIntelligence(from: string, to: string) {
  if (!VERIFICATION_STATUSES.includes(from as VerificationStatus)) return false;
  if (!VERIFICATION_STATUSES.includes(to as VerificationStatus)) return false;
  return TRANSITIONS[from as VerificationStatus].includes(to as VerificationStatus);
}

export function isIntelligenceUsable(item: IntelligenceValidity, asOf: Date) {
  if (item.verificationStatus !== "VERIFIED") return false;
  if (item.validFrom && new Date(item.validFrom) > asOf) return false;
  if (item.validUntil && new Date(item.validUntil) <= asOf) return false;
  return true;
}

export function validateIntelligenceReview(value: unknown): {
  status: "VERIFIED" | "REJECTED" | "ARCHIVED";
  reviewNote?: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.status !== "VERIFIED" && input.status !== "REJECTED" && input.status !== "ARCHIVED") return null;
  if (input.reviewNote !== undefined && typeof input.reviewNote !== "string") return null;
  const reviewNote = typeof input.reviewNote === "string" ? input.reviewNote.trim() : "";
  return reviewNote ? { status: input.status, reviewNote } : { status: input.status };
}
