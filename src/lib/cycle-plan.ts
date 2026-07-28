export type TierFrequencies = { A: number; B: number; C: number; D: number };

export type CycleProgressItem = {
  tierSnapshot: string;
  targetVisits: number;
  completedVisits: number;
  remainingVisits: number;
};

export type CycleSummary = {
  targetVisits: number;
  completedVisits: number;
  achievementRate: number;
  uncoveredCustomers: number;
};

export type TeamCycleRow = CycleSummary & {
  employeeId: string;
  employeeName: string;
};

const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export function parseCycleMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - 8 * 60 * 60 * 1000),
    end: new Date(Date.UTC(year, month, 1) - 8 * 60 * 60 * 1000),
  };
}

export function frequencyForTier(tier: string | null, frequencies: TierFrequencies) {
  return frequencies[tier === "A" || tier === "B" || tier === "C" ? tier : "D"];
}

export function validateFrequencies(value: unknown): TierFrequencies | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const valid = ["A", "B", "C", "D"].every(
    (tier) => Number.isInteger(candidate[tier]) && Number(candidate[tier]) >= 0 && Number(candidate[tier]) <= 31
  );
  if (!valid) return null;
  return { A: Number(candidate.A), B: Number(candidate.B), C: Number(candidate.C), D: Number(candidate.D) };
}

export function attachCycleProgress<T extends { hcpId: string; tierSnapshot: string; targetVisits: number }>(
  items: T[],
  visitsByHcp: Map<string, number>
) {
  return items.map((item) => {
    const completedVisits = visitsByHcp.get(item.hcpId) ?? 0;
    return {
      ...item,
      completedVisits,
      remainingVisits: Math.max(item.targetVisits - completedVisits, 0),
    };
  });
}

export function summarizeCycleItems(items: CycleProgressItem[]): CycleSummary {
  const targetVisits = items.reduce((sum, item) => sum + item.targetVisits, 0);
  const completedVisits = items.reduce(
    (sum, item) => sum + Math.min(item.completedVisits, item.targetVisits),
    0
  );
  return {
    targetVisits,
    completedVisits,
    achievementRate: targetVisits ? completedVisits / targetVisits : 0,
    uncoveredCustomers: items.filter((item) => item.targetVisits > 0 && item.completedVisits === 0).length,
  };
}

export function sortCycleGaps<T extends CycleProgressItem>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      (TIER_ORDER[left.tierSnapshot] ?? 4) - (TIER_ORDER[right.tierSnapshot] ?? 4) ||
      right.remainingVisits - left.remainingVisits
  );
}

export function cyclePlanToTourPlanHref(hcpId: string) {
  return `/tour-plans?hcpId=${encodeURIComponent(hcpId)}`;
}

export function summarizeTeamCycles(rows: TeamCycleRow[]) {
  const targetVisits = rows.reduce((sum, row) => sum + row.targetVisits, 0);
  const completedVisits = rows.reduce((sum, row) => sum + Math.min(row.completedVisits, row.targetVisits), 0);
  return {
    targetVisits,
    completedVisits,
    achievementRate: targetVisits ? completedVisits / targetVisits : 0,
    uncoveredCustomers: rows.reduce((sum, row) => sum + row.uncoveredCustomers, 0),
    laggingEmployees: rows.filter((row) => row.targetVisits > 0 && row.completedVisits / row.targetVisits < 0.3).length,
  };
}
