type RelevantIntelligence = {
  id: string;
  verificationStatus: string;
  priority: string;
  publishedAt: Date | string | null;
  validFrom?: Date | string | null;
  validUntil: Date | string | null;
  productIds: string[];
  therapeuticAreas: string[];
};

const PRIORITY_SCORE: Record<string, number> = { URGENT: 30, HIGH: 20, NORMAL: 10, LOW: 0 };

export function rankRelevantIntelligence<T extends RelevantIntelligence>(
  items: T[],
  context: {
    productIds: string[];
    therapeuticAreas: string[];
    asOf: Date;
    limit: number;
  },
) {
  const productIds = new Set(context.productIds);
  const areas = new Set(context.therapeuticAreas);
  return items
    .filter((item) => item.verificationStatus !== "REJECTED" && item.verificationStatus !== "ARCHIVED")
    .filter((item) => !item.validFrom || new Date(item.validFrom) <= context.asOf)
    .filter((item) => !item.validUntil || new Date(item.validUntil) > context.asOf)
    .map((item) => {
      const productMatch = item.productIds.some((id) => productIds.has(id));
      const areaMatch = item.therapeuticAreas.some((name) => areas.has(name));
      const score = (item.verificationStatus === "VERIFIED" ? 100 : 0)
        + (productMatch ? 50 : 0)
        + (areaMatch ? 20 : 0)
        + (PRIORITY_SCORE[item.priority] ?? 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score
      || new Date(b.item.publishedAt ?? 0).getTime() - new Date(a.item.publishedAt ?? 0).getTime()
      || a.item.id.localeCompare(b.item.id))
    .slice(0, Math.max(0, context.limit))
    .map(({ item }) => item);
}
