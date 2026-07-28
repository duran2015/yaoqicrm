import assert from "node:assert/strict";
import test from "node:test";
import {
  rankRepresentativeRecommendations,
  recommendationReason,
  sortRepresentativeFollowUps,
} from "./representative-workbench";

test("sorts overdue follow-ups before due date and priority", () => {
  const asOf = new Date("2026-07-24T12:00:00+08:00");
  const rows = [
    { id: "normal-high", dueDate: new Date("2026-07-25T00:00:00+08:00"), priority: "HIGH" },
    { id: "overdue-low", dueDate: new Date("2026-07-20T00:00:00+08:00"), priority: "LOW" },
    { id: "normal-low", dueDate: null, priority: "LOW" },
    { id: "normal-medium", dueDate: new Date("2026-07-25T00:00:00+08:00"), priority: "MEDIUM" },
  ];
  assert.deepEqual(sortRepresentativeFollowUps(rows, asOf).map((item) => item.id), [
    "overdue-low",
    "normal-high",
    "normal-medium",
    "normal-low",
  ]);
});

test("ranks recommendation by tier, remaining gap, then oldest coverage", () => {
  const rows = [
    { id: "b", tier: "B", remainingVisits: 5, lastVisitDate: null },
    { id: "a-recent", tier: "A", remainingVisits: 2, lastVisitDate: new Date("2026-07-20") },
    { id: "a-never", tier: "A", remainingVisits: 2, lastVisitDate: null },
    { id: "a-gap", tier: "A", remainingVisits: 3, lastVisitDate: new Date("2026-07-23") },
  ];
  assert.deepEqual(rankRepresentativeRecommendations(rows).map((item) => item.id), [
    "a-gap",
    "a-never",
    "a-recent",
    "b",
  ]);
});

test("explains recommendation using tier and remaining coverage", () => {
  assert.equal(recommendationReason({ tier: "A", remainingVisits: 3 }), "A 级客户，本月还差 3 次覆盖");
});
