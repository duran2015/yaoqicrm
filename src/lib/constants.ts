/** 演示数据基准日期(种子数据以 2026-07-24 为"今天") */
export const AS_OF = "2026-07-24";

/** 本周周一 2026-07-20 00:00 (+08:00),与种子数据 weekStart 精确匹配 */
export const WEEK_START_ISO = "2026-07-19T16:00:00.000Z";
export const WEEK_START_LABEL = "2026-07-20";

/** 拜访列表默认时间范围,覆盖可导入的历史数据及种子月 */
export const VISIT_FROM = "2026-06-01T00:00:00+08:00";
export const VISIT_TO = "2026-07-31T23:59:59+08:00";

/** 仪表盘"今日拜访"范围:2026-07-24 全天(+08:00) */
export const TODAY_FROM = "2026-07-23T16:00:00.000Z";
export const TODAY_TO = "2026-07-24T15:59:59.000Z";

export const ROLE_LABELS: Record<string, string> = {
  MR: "医药代表",
  ASM: "地区经理",
  RSM: "大区经理",
  ADMIN: "管理员",
};

export const TIER_LABELS: Record<string, string> = { A: "A 级", B: "B 级", C: "C 级", D: "D 级" };

/** 客户分级枚举(未分级 = null) */
export const TIER_OPTIONS = ["A", "B", "C", "D"];

/** 分级 badge 颜色:A=红 / B=橙 / C=蓝 / D=灰 */
export const TIER_BADGE_TONES: Record<string, "red" | "amber" | "blue" | "slate"> = {
  A: "red",
  B: "amber",
  C: "blue",
  D: "slate",
};

/** 分级图表颜色(A/B/C/D/未分级) */
export const TIER_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#3b82f6",
  D: "#64748b",
  未分级: "#cbd5e1",
};

/** HCO 客户分类 */
export const HCO_CATEGORY_OPTIONS = ["目标医院", "潜力医院", "观察医院"];

export const COOPERATION_STATUS_LABELS: Record<string, string> = {
  合作: "合作",
  暂停: "暂停",
  终止: "终止",
};

export const BUSINESS_STATUS_OPTIONS = ["正常", "注销", "未知"];

export const HOSPITAL_NATURE_OPTIONS = ["公立", "民营"];

/** 三态选项(是/否/不清楚),对齐参考系统 */
export const TRI_STATE_OPTIONS = ["是", "否", "不清楚"];

/** 国考成绩等级颜色:A++红 / A+橙 / A蓝 / B++灰 */
export const EXAM_GRADE_TONES: Record<string, "red" | "amber" | "blue" | "slate"> = {
  "A++": "red",
  "A+": "amber",
  A: "blue",
};

/** 建档申请类型 */
export const APPLICATION_TYPE_LABELS: Record<string, string> = {
  HCP_CREATE: "个人建档",
  HCO_CREATE: "企业建档",
  HCP_MODIFY: "档案修改",
  HCO_MODIFY: "档案修改",
};

/** 建档申请状态 */
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "待审核",
  APPROVED: "已批准",
  REJECTED: "已驳回",
};

/** 客户池选项 */
export const POOL_OPTIONS = ["架构客户池", "业绩客户池"];

/** 分配角色 */
export const ASSIGNMENT_ROLE_LABELS: Record<string, string> = {
  OWNER: "负责",
  COLLAB: "协作",
};

/** 证件类型选项 */
export const ID_TYPE_OPTIONS = ["身份证", "护照", "军官证", "港澳居民来往内地通行证"];

/** 学位 / 学历选项 */
export const DEGREE_OPTIONS = ["博士", "硕士", "学士"];
export const EDUCATION_OPTIONS = ["博士研究生", "硕士研究生", "本科", "大专"];

/** 行政职务 / 学术职称常用选项 */
export const ADMIN_DUTY_OPTIONS = ["科主任", "科副主任", "院长", "副院长", "无"];
export const ACADEMIC_TITLE_OPTIONS = ["教授", "副教授", "讲师", "无"];
export const DOCTOR_LEVEL_OPTIONS = ["主任医师", "副主任医师", "主治医师", "住院医师"];

/** 建档申请 payload 字段中文标签(审核页只读渲染用) */
export const PAYLOAD_FIELD_LABELS: Record<string, string> = {
  // 通用
  name: "名称", type: "机构类型", hcoId: "工作单位", pool: "客户池",
  // HCP
  title: "职称", specialty: "部门科室", gender: "性别", birthday: "生日", phone: "手机号码",
  wechat: "微信号", licenseNo: "医师资格证号",
  province: "省", city: "市", district: "区/县",
  doctorLevel: "医生等级", adminDuty: "行政职务", academicTitle: "学术职称",
  isPharmacyCommittee: "是否药事会成员", isClinicalPI: "是否临床试验PI", isGroupLeader: "是否带组医生",
  isMultiPractice: "是否多点执业", onlineConsult: "是否网络问诊",
  weeklyOutpatient: "周门诊量", managedBeds: "分管床位数", expertise: "擅长疾病", practiceScope: "执业范围",
  idType: "证件类型", idNumber: "证件号码",
  email: "邮箱", hometown: "籍贯", hobbies: "爱好", personalityTags: "性格标签",
  notes: "备注", tags: "标签",
  educations: "教育经历", bankAccounts: "银行账户",
  // HCO
  creditCode: "统一社会信用代码", level: "医疗机构等级", businessStatus: "经营状态",
  businessAddress: "注册地址", otherNames: "其他名称", address: "地址", category: "客户分类",
  regCapital: "注册资本", foundedDate: "成立日期", legalPerson: "法定代表人",
  businessScope: "经营范围", website: "官网", introduction: "单位介绍",
  hospitalNature: "医院性质", institutionType: "医疗机构类型", isInsurance: "是否医保定点",
  isClinicalTrial: "是否临床试验机构", isHeadquarters: "是否总院", isMilitary: "是否军队医院",
  teachingType: "教学医院类型", diagnosisSubjects: "诊疗科目",
  icuBeds: "ICU床位", openBeds: "开放床位", approvedBeds: "核定床位",
  doctorCount: "医生人数", dailyOutpatient: "日门诊量", annualDrugPurchase: "年购药金额(万元)",
  drugRatio: "药占比(%)", annualRevenue: "年营业额(万元)", annualSurgeries: "年手术量",
  annualAdmissions: "年入院患者数", diseaseAreas: "疾病领域",
  isStrategic: "战略重点医院", cooperationStatus: "合作状态", tier: "客户分级",
  departments: "科室信息", enteredProductIds: "已进院产品",
};

/** 嵌套子记录字段中文标签 */
export const PAYLOAD_NESTED_LABELS: Record<string, string> = {
  school: "毕业院校", major: "所学专业", mentor: "导师姓名", gradDate: "毕业时间",
  degree: "学位", education: "学历",
  accountName: "账户名称", bankName: "开户行", accountNo: "银行账号", accountType: "账户类型", isDefault: "默认账户",
  standardName: "标准科室", feature: "科室特色", ranking: "科室排名", overview: "科室概况",
};

export const VISIT_TYPE_LABELS: Record<string, string> = {
  FACE_TO_FACE: "面对面",
  PHONE: "电话",
  CONFERENCE: "会议",
  JOINT: "协同拜访",
};

export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审批",
  APPROVED: "已批准",
  REJECTED: "已驳回",
};

export const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: "积极",
  NEUTRAL: "中性",
  NEGATIVE: "消极",
};

export const HCO_TYPE_LABELS: Record<string, string> = {
  HOSPITAL: "医院",
  PHARMACY: "药店",
  DISTRIBUTOR: "商业公司",
};

/** 结构化拜访目的(多选,逗号分隔存储) */
export const PURPOSE_OPTIONS = ["产品信息传递", "临床信息沟通", "市场现状调研", "学术会议沟通", "其他"];

export const VALIDITY_LABELS: Record<string, string> = {
  PENDING: "未评定",
  VALID: "有效",
  INVALID: "无效",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "手工录入",
  AI: "AI 录入",
  IMPORT: "导入",
};

/** 评定为无效的快捷原因(真实导出数据中的常见值) */
export const INVALID_REASON_PRESETS = ["重复拜访记录", "内容过短", "签到地点不对", "结果未体现"];

export function isManagerRole(role?: string | null): boolean {
  return role === "ASM" || role === "RSM" || role === "ADMIN";
}
