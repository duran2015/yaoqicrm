import { INTELLIGENCE_TYPES, VERIFICATION_STATUSES } from "./sales-intelligence";

export type IntelligenceListFilters = {
  type: string | null;
  status: string | null;
  productId: string | null;
  query: string | null;
  page: number;
  pageSize: number;
};

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseIntelligenceListQuery(params: URLSearchParams): IntelligenceListFilters {
  const typeValue = params.get("type");
  const statusValue = params.get("status");
  const query = params.get("query")?.trim() || null;
  return {
    type: typeValue && INTELLIGENCE_TYPES.includes(typeValue as never) ? typeValue : null,
    status: statusValue && VERIFICATION_STATUSES.includes(statusValue as never) ? statusValue : null,
    productId: params.get("productId")?.trim() || null,
    query,
    page: positiveInteger(params.get("page"), 1),
    pageSize: Math.min(positiveInteger(params.get("pageSize"), 20), 50),
  };
}

export function buildIntelligenceWhere(filters: IntelligenceListFilters) {
  const where: Record<string, unknown> = {};
  if (filters.type) where.type = filters.type;
  where.verificationStatus = filters.status ?? { notIn: ["REJECTED", "ARCHIVED"] };
  if (filters.productId) where.products = { some: { productId: filters.productId } };
  if (filters.query) {
    where.OR = [
      { title: { contains: filters.query } },
      { summary: { contains: filters.query } },
      { contentExcerpt: { contains: filters.query } },
    ];
  }
  return where;
}

type IntelligenceRecord = {
  id: string;
  type: string;
  title: string;
  summary: string;
  contentExcerpt: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date | null;
  collectedAt: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  verificationStatus: string;
  confidence: string;
  priority: string;
  products: unknown[];
  therapeuticAreas: unknown[];
  competitors: unknown[];
};

export function shapeIntelligenceItem(record: IntelligenceRecord) {
  const excerpt = record.contentExcerpt ?? "";
  return {
    ...record,
    contentExcerpt: excerpt.length > 500 ? `${excerpt.slice(0, 500)}…` : excerpt,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    collectedAt: record.collectedAt.toISOString(),
    validFrom: record.validFrom?.toISOString() ?? null,
    validUntil: record.validUntil?.toISOString() ?? null,
  };
}
