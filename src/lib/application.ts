import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  HCP_STRING_FIELDS, HCP_INT_FIELDS, HCO_STRING_FIELDS, HCO_INT_FIELDS, HCO_FLOAT_FIELDS,
  pickFields, parseEducations, parseBankAccounts, parseDepartments,
} from "./customer";

export const APPLICATION_TYPES = ["HCP_CREATE", "HCO_CREATE", "HCP_MODIFY", "HCO_MODIFY"] as const;
export const APPLICATION_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;

export class ApplicationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 审核通过时按 type 落地 payload:
 * - HCP_CREATE:创建 HCP(含 educations/bankAccounts 子记录)+ 默认 assignment(申请人 OWNER)
 * - HCO_CREATE:创建 HCO(含 departments 子记录)+ 默认 assignment(申请人 OWNER)
 * - HCP_MODIFY / HCO_MODIFY:用 payload 标量字段更新目标档案
 * 返回落地后的档案 id
 */
export async function applyApprovedPayload(app: {
  type: string;
  payload: string;
  applicantId: string;
  targetHcpId: string | null;
  targetHcoId: string | null;
}): Promise<{ createdHcpId: string | null; createdHcoId: string | null }> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(app.payload) as Record<string, unknown>;
  } catch {
    throw new ApplicationError(400, "payload 不是合法 JSON,无法落地");
  }

  if (app.type === "HCP_CREATE") {
    if (!payload.name || typeof payload.name !== "string") {
      throw new ApplicationError(400, "payload.name 为必填字段(HCP_CREATE)");
    }
    const data = pickFields(payload, HCP_STRING_FIELDS, HCP_INT_FIELDS) as Prisma.HcpCreateInput;
    const educations = parseEducations(payload.educations);
    const bankAccounts = parseBankAccounts(payload.bankAccounts);
    if (educations.length) data.educations = { create: educations };
    if (bankAccounts.length) data.bankAccounts = { create: bankAccounts };
    const hcp = await prisma.hcp.create({ data });
    await prisma.customerAssignment.create({
      data: { hcpId: hcp.id, employeeId: app.applicantId, role: "OWNER" },
    });
    return { createdHcpId: hcp.id, createdHcoId: null };
  }

  if (app.type === "HCO_CREATE") {
    if (!payload.name || typeof payload.name !== "string") {
      throw new ApplicationError(400, "payload.name 为必填字段(HCO_CREATE)");
    }
    const data = pickFields(payload, HCO_STRING_FIELDS, HCO_INT_FIELDS, HCO_FLOAT_FIELDS) as Prisma.HcoCreateInput;
    if (!payload.type) data.type = "HOSPITAL";
    const departments = parseDepartments(payload.departments);
    if (departments.length) data.departments = { create: departments };
    const hco = await prisma.hco.create({ data });
    await prisma.customerAssignment.create({
      data: { hcoId: hco.id, employeeId: app.applicantId, role: "OWNER" },
    });
    return { createdHcpId: null, createdHcoId: hco.id };
  }

  if (app.type === "HCP_MODIFY") {
    if (!app.targetHcpId) throw new ApplicationError(400, "HCP_MODIFY 缺少 targetHcpId");
    const target = await prisma.hcp.findUnique({ where: { id: app.targetHcpId } });
    if (!target) throw new ApplicationError(404, "目标 HCP 不存在,无法落地修改");
    const data = pickFields(payload, HCP_STRING_FIELDS, HCP_INT_FIELDS) as Prisma.HcpUpdateInput;
    delete data.name; // name 为必填字段,MODIFY 仅在显式传入时更新
    if (typeof payload.name === "string" && payload.name.trim()) data.name = payload.name.trim();
    await prisma.hcp.update({ where: { id: app.targetHcpId }, data });
    return { createdHcpId: app.targetHcpId, createdHcoId: null };
  }

  if (app.type === "HCO_MODIFY") {
    if (!app.targetHcoId) throw new ApplicationError(400, "HCO_MODIFY 缺少 targetHcoId");
    const target = await prisma.hco.findUnique({ where: { id: app.targetHcoId } });
    if (!target) throw new ApplicationError(404, "目标 HCO 不存在,无法落地修改");
    const data = pickFields(payload, HCO_STRING_FIELDS, HCO_INT_FIELDS, HCO_FLOAT_FIELDS) as Prisma.HcoUpdateInput;
    delete data.name;
    if (typeof payload.name === "string" && payload.name.trim()) data.name = payload.name.trim();
    delete data.type; // type 不允许经 MODIFY 修改
    await prisma.hco.update({ where: { id: app.targetHcoId }, data });
    return { createdHcpId: null, createdHcoId: app.targetHcoId };
  }

  throw new ApplicationError(400, `未知的申请类型:${app.type}`);
}
