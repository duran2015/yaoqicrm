export type AccountPlanProgress = {
  total: number;
  completed: number;
  progress: number;
  overdue: number;
};

export type MilestoneInput = {
  title: string;
  description: string | null;
  ownerId: string;
  dueDate: Date;
};

export type AccountPlanInput = {
  hcoId: string;
  year: number;
  ownerId: string;
  createdById: string;
  businessGoal: string;
  situation: string | null;
  strategy: string;
  successCriteria: string;
  productIds: string[];
  stakeholders: Array<{
    hcpId: string;
    decisionRole: "DECISION_MAKER" | "INFLUENCER" | "SUPPORTER";
    attitude: "ADVOCATE" | "SUPPORTIVE" | "NEUTRAL" | "OPPOSED";
    notes: string | null;
  }>;
  milestones: MilestoneInput[];
};

const ACCOUNT_PLAN_TRANSITIONS: Record<string, string[]> = { ACTIVE: ["CLOSED"], CLOSED: [] };
const MILESTONE_TRANSITIONS: Record<string, string[]> = { OPEN: ["DONE", "CANCELLED"], DONE: [], CANCELLED: [] };
const DECISION_ROLES = new Set(["DECISION_MAKER", "INFLUENCER", "SUPPORTER"]);
const ATTITUDES = new Set(["ADVOCATE", "SUPPORTIVE", "NEUTRAL", "OPPOSED"]);

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseBusinessDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isAccountPlanYear(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 2020 && Number(value) <= 2100;
}

export function canTransitionAccountPlan(from: string, to: string) {
  return ACCOUNT_PLAN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionMilestone(from: string, to: string) {
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function summarizeMilestones(
  items: Array<{ status: string; dueDate: string | Date }>,
  now: Date
): AccountPlanProgress {
  const relevant = items.filter((item) => item.status !== "CANCELLED");
  const completed = relevant.filter((item) => item.status === "DONE").length;
  const overdue = relevant.filter((item) => item.status === "OPEN" && new Date(item.dueDate) < now).length;
  return {
    total: relevant.length,
    completed,
    progress: relevant.length ? completed / relevant.length : 0,
    overdue,
  };
}

export function isDecisionMakerCovered(
  stakeholder: { hcpId: string; decisionRole: string },
  visits: Array<{ employeeId: string; hcpId: string | null; status: string }>,
  ownerId: string
) {
  if (stakeholder.decisionRole !== "DECISION_MAKER") return true;
  return visits.some(
    (visit) => visit.employeeId === ownerId && visit.hcpId === stakeholder.hcpId && visit.status === "SUBMITTED"
  );
}

export function summarizeAccountPlanTeam(
  rows: Array<{ progress: number; overdue: number; uncoveredDecisionMakers: number }>
) {
  const planCount = rows.length;
  return {
    planCount,
    averageProgress: planCount ? rows.reduce((sum, row) => sum + row.progress, 0) / planCount : 0,
    overdueMilestones: rows.reduce((sum, row) => sum + row.overdue, 0),
    uncoveredDecisionMakers: rows.reduce((sum, row) => sum + row.uncoveredDecisionMakers, 0),
    atRiskPlans: rows.filter((row) => row.overdue > 0 || row.uncoveredDecisionMakers > 0).length,
  };
}

export function validateMilestoneInput(value: unknown): MilestoneInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const title = requiredString(candidate.title);
  const ownerId = requiredString(candidate.ownerId);
  const dueDate = parseBusinessDate(candidate.dueDate);
  if (!title || !ownerId || !dueDate) return null;
  return { title, description: optionalString(candidate.description), ownerId, dueDate };
}

export function validateAccountPlanInput(value: unknown): AccountPlanInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const hcoId = requiredString(candidate.hcoId);
  const ownerId = requiredString(candidate.ownerId);
  const createdById = requiredString(candidate.createdById);
  const businessGoal = requiredString(candidate.businessGoal);
  const strategy = requiredString(candidate.strategy);
  const successCriteria = requiredString(candidate.successCriteria);
  if (!hcoId || !ownerId || !createdById || !businessGoal || !strategy || !successCriteria || !isAccountPlanYear(candidate.year)) return null;

  const productIds = Array.isArray(candidate.productIds)
    ? [...new Set(candidate.productIds.map(requiredString).filter((id): id is string => Boolean(id)))]
    : [];
  if (!productIds.length) return null;

  if (!Array.isArray(candidate.stakeholders) || !Array.isArray(candidate.milestones)) return null;
  const stakeholders: AccountPlanInput["stakeholders"] = [];
  for (const raw of candidate.stakeholders) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    const hcpId = requiredString(item.hcpId);
    if (!hcpId || typeof item.decisionRole !== "string" || !DECISION_ROLES.has(item.decisionRole) || typeof item.attitude !== "string" || !ATTITUDES.has(item.attitude)) return null;
    stakeholders.push({
      hcpId,
      decisionRole: item.decisionRole as AccountPlanInput["stakeholders"][number]["decisionRole"],
      attitude: item.attitude as AccountPlanInput["stakeholders"][number]["attitude"],
      notes: optionalString(item.notes),
    });
  }
  if (new Set(stakeholders.map((item) => item.hcpId)).size !== stakeholders.length) return null;

  const milestones = candidate.milestones.map(validateMilestoneInput);
  if (milestones.some((item) => !item)) return null;
  return {
    hcoId,
    year: candidate.year,
    ownerId,
    createdById,
    businessGoal,
    situation: optionalString(candidate.situation),
    strategy,
    successCriteria,
    productIds,
    stakeholders,
    milestones: milestones as MilestoneInput[],
  };
}
