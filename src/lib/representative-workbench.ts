const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

type FollowUpRankable = {
  id: string;
  dueDate: Date | string | null;
  priority: string;
};

type RecommendationRankable = {
  id: string;
  tier: string;
  remainingVisits: number;
  lastVisitDate: Date | string | null;
};

export function sortRepresentativeFollowUps<T extends FollowUpRankable>(items: T[], asOf: Date): T[] {
  return [...items].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const overdueDifference = Number(bDue < asOf.getTime()) - Number(aDue < asOf.getTime());
    return overdueDifference
      || aDue - bDue
      || (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
      || a.id.localeCompare(b.id);
  });
}

export function rankRepresentativeRecommendations<T extends RecommendationRankable>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4)
    || b.remainingVisits - a.remainingVisits
    || (a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : Number.NEGATIVE_INFINITY)
      - (b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : Number.NEGATIVE_INFINITY)
    || a.id.localeCompare(b.id)
  );
}

export function recommendationReason(item: Pick<RecommendationRankable, "tier" | "remainingVisits">) {
  return `${item.tier} 级客户，本月还差 ${item.remainingVisits} 次覆盖`;
}
