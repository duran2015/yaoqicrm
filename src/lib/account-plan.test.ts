import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionAccountPlan,
  canTransitionMilestone,
  isAccountPlanYear,
  isDecisionMakerCovered,
  summarizeAccountPlanTeam,
  summarizeMilestones,
  validateAccountPlanInput,
  validateMilestoneInput,
} from "./account-plan";

test("accepts only integer account plan years from 2020 through 2100", () => {
  assert.equal(isAccountPlanYear(2020), true);
  assert.equal(isAccountPlanYear(2100), true);
  assert.equal(isAccountPlanYear(2019), false);
  assert.equal(isAccountPlanYear(2101), false);
  assert.equal(isAccountPlanYear(2026.5), false);
  assert.equal(isAccountPlanYear("2026"), false);
});

test("keeps account plans closed once they reach the terminal state", () => {
  assert.equal(canTransitionAccountPlan("ACTIVE", "CLOSED"), true);
  assert.equal(canTransitionAccountPlan("CLOSED", "ACTIVE"), false);
  assert.equal(canTransitionAccountPlan("ACTIVE", "ACTIVE"), false);
});

test("allows milestones to finish or cancel but never reopen", () => {
  assert.equal(canTransitionMilestone("OPEN", "DONE"), true);
  assert.equal(canTransitionMilestone("OPEN", "CANCELLED"), true);
  assert.equal(canTransitionMilestone("DONE", "OPEN"), false);
  assert.equal(canTransitionMilestone("CANCELLED", "OPEN"), false);
});

test("excludes cancelled milestones from progress and overdue counts", () => {
  assert.deepEqual(
    summarizeMilestones(
      [
        { status: "DONE", dueDate: "2026-07-20T00:00:00.000Z" },
        { status: "OPEN", dueDate: "2026-07-26T16:00:00.000Z" },
        { status: "CANCELLED", dueDate: "2026-07-01T00:00:00.000Z" },
      ],
      new Date("2026-07-27T16:00:00.000Z")
    ),
    { total: 2, completed: 1, progress: 0.5, overdue: 1 }
  );
  assert.deepEqual(summarizeMilestones([], new Date()), { total: 0, completed: 0, progress: 0, overdue: 0 });
});

test("requires the plan owner to have submitted a visit to cover a decision maker", () => {
  const stakeholder = { hcpId: "hcp-1", decisionRole: "DECISION_MAKER" };
  assert.equal(isDecisionMakerCovered(stakeholder, [{ employeeId: "owner-1", hcpId: "hcp-1", status: "SUBMITTED" }], "owner-1"), true);
  assert.equal(isDecisionMakerCovered(stakeholder, [{ employeeId: "other", hcpId: "hcp-1", status: "SUBMITTED" }], "owner-1"), false);
  assert.equal(isDecisionMakerCovered(stakeholder, [{ employeeId: "owner-1", hcpId: "hcp-1", status: "DRAFT" }], "owner-1"), false);
  assert.equal(isDecisionMakerCovered({ hcpId: "hcp-1", decisionRole: "INFLUENCER" }, [], "owner-1"), true);
});

test("summarizes account plan management risks", () => {
  assert.deepEqual(
    summarizeAccountPlanTeam([
      { progress: 1, overdue: 0, uncoveredDecisionMakers: 0 },
      { progress: 0.5, overdue: 0, uncoveredDecisionMakers: 1 },
      { progress: 0, overdue: 2, uncoveredDecisionMakers: 0 },
    ]),
    {
      planCount: 3,
      averageProgress: 0.5,
      overdueMilestones: 2,
      uncoveredDecisionMakers: 1,
      atRiskPlans: 2,
    }
  );
});

const validPlan = {
  hcoId: "hco-1",
  year: 2026,
  ownerId: "owner-1",
  createdById: "creator-1",
  businessGoal: "完成核心产品进院",
  situation: "药事会窗口明确",
  strategy: "用临床证据推动准入",
  successCriteria: "完成准入并覆盖三个科室",
  productIds: ["product-1"],
  stakeholders: [{ hcpId: "hcp-1", decisionRole: "DECISION_MAKER", attitude: "NEUTRAL", notes: "" }],
  milestones: [{ title: "准备药事材料", description: "", ownerId: "owner-1", dueDate: "2026-08-15" }],
};

test("validates complete account plan input without accepting empty strategy data", () => {
  assert.ok(validateAccountPlanInput(validPlan));
  assert.equal(validateAccountPlanInput({ ...validPlan, businessGoal: "" }), null);
  assert.equal(validateAccountPlanInput({ ...validPlan, strategy: "" }), null);
  assert.equal(validateAccountPlanInput({ ...validPlan, successCriteria: "" }), null);
  assert.equal(validateAccountPlanInput({ ...validPlan, productIds: [] }), null);
  assert.equal(validateAccountPlanInput({ ...validPlan, stakeholders: [{ ...validPlan.stakeholders[0], decisionRole: "UNKNOWN" }] }), null);
});

test("validates milestone owner, title, and date", () => {
  assert.deepEqual(validateMilestoneInput({ title: "完成材料", description: "", ownerId: "owner-1", dueDate: "2026-08-15" }), {
    title: "完成材料",
    description: null,
    ownerId: "owner-1",
    dueDate: new Date("2026-08-14T16:00:00.000Z"),
  });
  assert.equal(validateMilestoneInput({ title: "", ownerId: "owner-1", dueDate: "2026-08-15" }), null);
  assert.equal(validateMilestoneInput({ title: "完成材料", ownerId: "", dueDate: "2026-08-15" }), null);
  assert.equal(validateMilestoneInput({ title: "完成材料", ownerId: "owner-1", dueDate: "bad" }), null);
});
