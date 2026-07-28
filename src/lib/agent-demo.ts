export type VisitPreparationMaterial = {
  productId: string;
  status: string;
  effectiveDate: Date;
  expiryDate: Date | null;
};

export function selectVisitPreparationMaterials<T extends VisitPreparationMaterial>(
  materials: T[],
  productIds: Set<string>,
  asOf: Date,
): T[] {
  return materials.filter(
    (material) =>
      productIds.has(material.productId) &&
      material.status === "APPROVED" &&
      material.effectiveDate <= asOf &&
      (!material.expiryDate || material.expiryDate >= asOf),
  );
}

type RepresentativeProfile = {
  id: string;
  name: string;
  employeeCode: string;
  role: string;
  division: string;
};

type WorkbenchPayload = {
  todaySchedule?: unknown[];
  followUps?: unknown[];
  recommendations?: unknown[];
};

export function buildMyDay(
  representative: RepresentativeProfile,
  workbench: WorkbenchPayload,
  kpis: unknown,
  asOf: string,
) {
  return {
    asOf,
    representative,
    todaySchedule: workbench.todaySchedule ?? [],
    followUps: workbench.followUps ?? [],
    recommendations: workbench.recommendations ?? [],
    kpis,
  };
}
