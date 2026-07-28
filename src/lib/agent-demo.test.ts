import assert from "node:assert/strict";
import test from "node:test";
import { buildMyDay, selectVisitPreparationMaterials } from "./agent-demo";

test("selectVisitPreparationMaterials keeps only approved effective materials for discussed products", () => {
  const materials = [
    {
      id: "usable",
      productId: "product-1",
      status: "APPROVED",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: new Date("2026-12-31T23:59:59.999Z"),
    },
    {
      id: "expired",
      productId: "product-1",
      status: "APPROVED",
      effectiveDate: new Date("2025-01-01T00:00:00.000Z"),
      expiryDate: new Date("2026-06-30T23:59:59.999Z"),
    },
    {
      id: "draft",
      productId: "product-1",
      status: "DRAFT",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: new Date("2026-12-31T23:59:59.999Z"),
    },
    {
      id: "other-product",
      productId: "product-2",
      status: "APPROVED",
      effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
      expiryDate: null,
    },
  ];

  const selected = selectVisitPreparationMaterials(
    materials,
    new Set(["product-1"]),
    new Date("2026-07-28T12:00:00.000Z"),
  );
  assert.deepEqual(selected.map((item) => item.id), ["usable"]);
});

test("buildMyDay exposes the CRM-backed actor profile with workbench and KPI data", () => {
  const result = buildMyDay(
    { id: "employee-1", name: "刘洋", employeeCode: "YG1001", role: "MR", division: "肿瘤线" },
    { todaySchedule: [{ id: "plan-1" }], followUps: [], recommendations: [] },
    { todayVisits: 2, monthlyAchievementRate: 0.82 },
    "2026-07-28T00:00:00.000Z",
  );
  assert.deepEqual(result, {
    asOf: "2026-07-28T00:00:00.000Z",
    representative: {
      id: "employee-1",
      name: "刘洋",
      employeeCode: "YG1001",
      role: "MR",
      division: "肿瘤线",
    },
    todaySchedule: [{ id: "plan-1" }],
    followUps: [],
    recommendations: [],
    kpis: { todayVisits: 2, monthlyAchievementRate: 0.82 },
  });
});
