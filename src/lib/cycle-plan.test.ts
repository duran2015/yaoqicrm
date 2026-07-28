import assert from "node:assert/strict";
import test from "node:test";
import {
  attachCycleProgress,
  cyclePlanToTourPlanHref,
  frequencyForTier,
  parseCycleMonth,
  sortCycleGaps,
  summarizeCycleItems,
  summarizeTeamCycles,
  validateFrequencies,
} from "./cycle-plan";

test("parses a cycle month into Shanghai boundaries", () => {
  assert.deepEqual(parseCycleMonth("2026-07"), {
    start: new Date("2026-06-30T16:00:00.000Z"),
    end: new Date("2026-07-31T16:00:00.000Z"),
  });
  assert.equal(parseCycleMonth("2026-7"), null);
  assert.equal(parseCycleMonth("not-a-month"), null);
});

test("maps missing tiers to D frequency", () => {
  const frequencies = { A: 4, B: 2, C: 1, D: 0 };
  assert.equal(frequencyForTier("A", frequencies), 4);
  assert.equal(frequencyForTier(null, frequencies), 0);
  assert.equal(frequencyForTier("UNKNOWN", frequencies), 0);
});

test("summarizes coverage with capped completion", () => {
  assert.deepEqual(
    summarizeCycleItems([
      { tierSnapshot: "A", targetVisits: 2, completedVisits: 3, remainingVisits: 0 },
      { tierSnapshot: "B", targetVisits: 2, completedVisits: 1, remainingVisits: 1 },
      { tierSnapshot: "D", targetVisits: 0, completedVisits: 0, remainingVisits: 0 },
    ]),
    {
      targetVisits: 4,
      completedVisits: 3,
      achievementRate: 0.75,
      uncoveredCustomers: 0,
    }
  );
  assert.equal(summarizeCycleItems([]).achievementRate, 0);
});

test("sorts priority gaps by tier then remaining visits", () => {
  const sorted = sortCycleGaps([
    { tierSnapshot: "B", targetVisits: 2, completedVisits: 0, remainingVisits: 2 },
    { tierSnapshot: "A", targetVisits: 4, completedVisits: 3, remainingVisits: 1 },
    { tierSnapshot: "A", targetVisits: 4, completedVisits: 0, remainingVisits: 4 },
  ]);
  assert.deepEqual(sorted.map((item) => item.remainingVisits), [4, 1, 2]);
});

test("validates all tier frequencies as integers from zero to 31", () => {
  assert.deepEqual(validateFrequencies({ A: 4, B: 2, C: 1, D: 0 }), { A: 4, B: 2, C: 1, D: 0 });
  assert.equal(validateFrequencies({ A: -1, B: 2, C: 1, D: 0 }), null);
  assert.equal(validateFrequencies({ A: 1.5, B: 2, C: 1, D: 0 }), null);
  assert.equal(validateFrequencies({ A: 32, B: 2, C: 1, D: 0 }), null);
  assert.equal(validateFrequencies({ A: 4, B: 2, C: 1 }), null);
});

test("attaches submitted visit counts by HCP without negative gaps", () => {
  const items = attachCycleProgress(
    [
      { id: "i1", hcpId: "h1", tierSnapshot: "A", targetVisits: 2 },
      { id: "i2", hcpId: "h2", tierSnapshot: "B", targetVisits: 2 },
    ],
    new Map([["h1", 3]])
  );
  assert.deepEqual(items.map(({ completedVisits, remainingVisits }) => ({ completedVisits, remainingVisits })), [
    { completedVisits: 3, remainingVisits: 0 },
    { completedVisits: 0, remainingVisits: 2 },
  ]);
});

test("builds an encoded weekly plan handoff URL", () => {
  assert.equal(cyclePlanToTourPlanHref("hcp/a b"), "/tour-plans?hcpId=hcp%2Fa%20b");
});

test("aggregates team cycle states", () => {
  assert.deepEqual(
    summarizeTeamCycles([
      { employeeId: "e1", employeeName: "高达成", targetVisits: 10, completedVisits: 9, uncoveredCustomers: 0 },
      { employeeId: "e2", employeeName: "进行中", targetVisits: 10, completedVisits: 5, uncoveredCustomers: 2 },
      { employeeId: "e3", employeeName: "落后", targetVisits: 10, completedVisits: 1, uncoveredCustomers: 5 },
    ]),
    {
      targetVisits: 30,
      completedVisits: 15,
      achievementRate: 0.5,
      uncoveredCustomers: 7,
      laggingEmployees: 1,
    }
  );
});
