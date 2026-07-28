import { prisma } from "./prisma";

/** 合作代表(分配关系)的 include:代表姓名 + 所属办事处(五级部门) */
export const assignmentInclude = {
  include: {
    employee: {
      select: {
        id: true,
        name: true,
        role: true,
        employeeCode: true,
        department: { select: { id: true, name: true, level: true } },
      },
    },
  },
} as const;

/** HCP 字符串标量字段(POST/PATCH 可写) */
export const HCP_STRING_FIELDS = [
  "name", "title", "specialty", "tier", "hcoId", "phone", "wechat", "tags", "notes",
  "gender", "birthday", "licenseNo",
  "adminDuty", "academicTitle", "doctorLevel",
  "isMultiPractice", "onlineConsult", "isClinicalPI", "isGroupLeader", "isPharmacyCommittee",
  "practiceScope", "expertise", "practiceCertNo", "titleCertNo",
  "email", "hometown", "hobbies", "personalityTags", "homeAddress",
  "idType", "idNumber",
] as const;

/** HCP 整数标量字段 */
export const HCP_INT_FIELDS = ["weeklyOutpatient", "managedBeds"] as const;

/** HCO 字符串标量字段(POST 可写) */
export const HCO_STRING_FIELDS = [
  "name", "type", "level", "address", "territoryId",
  "creditCode", "province", "city", "district", "otherNames", "businessStatus",
  "phone", "businessAddress", "category",
  "regCapital", "foundedDate", "legalPerson", "businessScope", "website", "introduction",
  "hospitalNature", "institutionType", "isMilitary", "isInsurance", "isClinicalTrial",
  "isHeadquarters", "teachingType", "diagnosisSubjects", "diseaseAreas",
  "isStrategic", "cooperationStatus", "tier", "kaOwnerId",
] as const;

export const HCO_INT_FIELDS = [
  "icuBeds", "openBeds", "approvedBeds", "doctorCount",
  "dailyOutpatient", "annualSurgeries", "annualAdmissions",
] as const;

export const HCO_FLOAT_FIELDS = ["annualDrugPurchase", "annualRevenue", "drugRatio"] as const;

export const TIERS = ["A", "B", "C", "D"] as const;

/** 从 body 提取标量字段(字符串字段 null 透传;int/float 字段做数字转换) */
export function pickFields(
  body: Record<string, unknown>,
  stringFields: readonly string[],
  intFields: readonly string[] = [],
  floatFields: readonly string[] = [],
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of stringFields) {
    if (f in body) data[f] = body[f] === null || body[f] === undefined ? null : String(body[f]);
  }
  for (const f of intFields) {
    if (f in body) {
      const v = body[f];
      data[f] = v === null || v === undefined || v === "" ? null : Number.parseInt(String(v), 10);
      if (data[f] !== null && Number.isNaN(data[f])) data[f] = null;
    }
  }
  for (const f of floatFields) {
    if (f in body) {
      const v = body[f];
      data[f] = v === null || v === undefined || v === "" ? null : Number.parseFloat(String(v));
      if (data[f] !== null && Number.isNaN(data[f])) data[f] = null;
    }
  }
  return data;
}

export interface EducationInput {
  school?: string; major?: string; mentor?: string; gradDate?: string; degree?: string; education?: string;
}
export interface BankAccountInput {
  accountName?: string; bankName?: string; accountNo?: string; accountType?: string; isDefault?: boolean;
}

/** 解析嵌套教育经历数组 */
export function parseEducations(raw: unknown): EducationInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === "object")
    .map((e) => {
      const o = e as Record<string, unknown>;
      return {
        school: o.school ? String(o.school) : undefined,
        major: o.major ? String(o.major) : undefined,
        mentor: o.mentor ? String(o.mentor) : undefined,
        gradDate: o.gradDate ? String(o.gradDate) : undefined,
        degree: o.degree ? String(o.degree) : undefined,
        education: o.education ? String(o.education) : undefined,
      };
    });
}

/** 解析嵌套银行账户数组 */
export function parseBankAccounts(raw: unknown): BankAccountInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === "object")
    .map((e) => {
      const o = e as Record<string, unknown>;
      return {
        accountName: o.accountName ? String(o.accountName) : undefined,
        bankName: o.bankName ? String(o.bankName) : undefined,
        accountNo: o.accountNo ? String(o.accountNo) : undefined,
        accountType: o.accountType ? String(o.accountType) : undefined,
        isDefault: Boolean(o.isDefault),
      };
    });
}

export interface DepartmentInput {
  name: string; standardName?: string; feature?: string; ranking?: string; overview?: string;
}

/** 解析嵌套 HCO 科室数组 */
export function parseDepartments(raw: unknown): DepartmentInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === "object" && typeof (e as Record<string, unknown>).name === "string")
    .map((e) => {
      const o = e as Record<string, unknown>;
      return {
        name: String(o.name),
        standardName: o.standardName ? String(o.standardName) : undefined,
        feature: o.feature ? String(o.feature) : undefined,
        ranking: o.ranking ? String(o.ranking) : undefined,
        overview: o.overview ? String(o.overview) : undefined,
      };
    });
}

/** 校验员工存在 */
export async function employeeExists(id: string): Promise<boolean> {
  return (await prisma.employee.count({ where: { id } })) > 0;
}
