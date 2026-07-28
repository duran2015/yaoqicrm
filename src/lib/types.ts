/** 与 API.md 严格对齐的接口类型 */

export interface TerritoryRef {
  id: string;
  name: string;
  level?: string;
  parentId?: string | null;
}

export interface Employee {
  id: string;
  employeeCode?: string;
  name: string;
  role: string;
  division: string;
  phone?: string | null;
  reportsToId?: string | null;
  territory?: TerritoryRef | null;
  department?: { id: string; name: string; level: number } | null;
  departmentPath?: string | null;
  subordinates?: Employee[];
}

export interface Department {
  id: string;
  name: string;
  level: number; // 1=事业部 2=战区 3=分管区 4=区 5=办事处
  parentId?: string | null;
  employeeCount?: number;
  children?: Department[];
}

export interface Hco {
  id: string;
  code?: string | null;
  name: string;
  type: string;
  level?: string | null;
  tier?: string | null; // A | B | C | D,null=未分级
  address?: string | null;
  territory?: TerritoryRef | null;
  isStrategic?: string | null;
  kaOwner?: { id: string; name: string; role: string } | null;
  _count?: { hcps: number; visits: number };
}

export interface Hcp {
  id: string;
  code?: string | null;
  name: string;
  title?: string | null;
  specialty?: string | null;
  tier?: string | null; // A | B | C | D,null=未分级
  hcoId?: string | null;
  phone?: string | null;
  wechat?: string | null;
  tags?: string | null;
  notes?: string | null;
  hco?: Hco | null;
  assignments?: CustomerAssignment[];
}

export interface SampleLot {
  id: string;
  lotNumber: string;
  expiryDate: string;
  totalQty?: number;
  productId?: string;
}

export interface Product {
  id: string;
  brand: string;
  molecule: string;
  therapeuticCategory: string;
  division: string;
  price?: number | null;
  unit?: string | null;
  sampleLots?: SampleLot[];
}

export interface VisitProductItem {
  id: string;
  feedback?: string | null;
  product: { id: string; brand: string; molecule: string };
}

export interface VisitSampleItem {
  id: string;
  quantity: number;
  type: string;
  lot: { lotNumber: string; product: { id: string; brand: string } };
}

export interface CheckIn {
  id: string;
  checkinTime: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string; // NORMAL | LOCATION_MISMATCH
}

export interface Visit {
  id: string;
  status?: string;
  visitDate: string;
  type: string;
  purpose?: string | null;
  purposes?: string | null;
  outcome?: string | null;
  duration?: number | null;
  notes?: string | null;
  summary?: string | null;
  nextStep?: string | null;
  aiSummary?: string | null;
  aiSentiment?: string | null;
  source?: string; // MANUAL | AI | IMPORT
  validityStatus?: string; // PENDING | VALID | INVALID
  invalidReason?: string | null;
  evaluatedAt?: string | null;
  employee: { id: string; name: string; role: string };
  receiver?: { id: string; name: string; role: string } | null;
  evaluatedBy?: { id: string; name: string; role: string } | null;
  hcp?: { id: string; code?: string | null; name: string; title?: string | null; tier?: string; hco?: { id: string; name: string } | null } | null;
  hco?: { id: string; code?: string | null; name: string } | null;
  products: VisitProductItem[];
  samples: VisitSampleItem[];
  checkins?: CheckIn[];
}

export interface HcpDetail extends Hcp, HcpProfileFields {
  educations: HcpEducation[];
  bankAccounts: HcpBankAccount[];
  visits: Visit[];
  eventAttendances: {
    id: string;
    event: { id: string; name: string; type: string; eventDate: string; location?: string | null };
  }[];
  sampleSummary: { product: { id: string; brand: string; molecule: string }; totalQty: number }[];
  stats: { visitCount: number; eventCount: number; lastVisitDate?: string | null };
  followUpTasks: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    priority: string;
    assignee: { id: string; name: string };
  }>;
}

export interface TourPlanItem {
  id: string;
  planDate: string;
  hcpId?: string | null;
  hcp?: { id: string; name: string; title?: string | null; tier?: string; hco?: { id: string; name: string } | null } | null;
  hcoName?: string | null;
  note?: string | null;
  status: string;
  visitId?: string | null;
}

export interface TourPlan {
  id: string;
  weekStart: string;
  status: string;
  rejectReason?: string | null;
  approvedAt?: string | null;
  employee: { id: string; name: string; role: string; division: string };
  items: TourPlanItem[];
}

export interface InventoryProduct {
  product: { id: string; brand: string; molecule: string; unit?: string | null };
  received: number;
  distributed: number;
  current: number;
  lots: {
    lotId: string;
    lotNumber: string;
    expiryDate: string;
    received: number;
    distributed: number;
    current: number;
  }[];
}

export interface MedEvent {
  id: string;
  name: string;
  type: string;
  eventDate: string;
  location?: string | null;
  budget?: number | null;
  status: string;
  _count?: { attendees: number };
  attendees?: {
    id: string;
    status: string;
    checkedInAt?: string | null;
    hcp: { id: string; name: string; title?: string | null; tier?: string; hco?: { id: string; name: string } | null };
  }[];
}

export interface FollowUpTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  completedAt?: string | null;
  assignee: { id: string; name: string; role: string };
  hcp?: { id: string; name: string; title?: string | null; hco?: { id: string; name: string } | null } | null;
  hco?: { id: string; name: string } | null;
  sourceVisitId?: string | null;
  sourceEventId?: string | null;
  followUpVisitId?: string | null;
}

export interface CoachingAction {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  completedAt?: string | null;
  manager: { id: string; name: string };
  employee: { id: string; name: string; role: string };
  sourceVisitId?: string | null;
}

export interface AccountStakeholder {
  id: string;
  decisionRole: string;
  attitude: string;
  notes?: string | null;
  covered?: boolean;
  lastVisitDate?: string | null;
  hcp: { id: string; name: string; title?: string | null; tier?: string | null; hco?: { id: string; name: string } | null };
}

export interface AccountMilestone {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  status: string;
  completedAt?: string | null;
  owner: { id: string; name: string; role: string };
  followUpTask?: { id: string; title: string; status: string; dueDate?: string | null } | null;
}

export interface AccountPlan {
  id: string;
  year: number;
  status: string;
  businessGoal: string;
  situation?: string | null;
  strategy: string;
  successCriteria: string;
  hco: { id: string; name: string; level?: string | null; isStrategic?: string | null };
  owner: { id: string; name: string; role: string; division: string };
  products: Array<{ id: string; product: Product }>;
  stakeholders: AccountStakeholder[];
  milestones: AccountMilestone[];
  progress: { total: number; completed: number; progress: number; overdue: number };
  uncoveredDecisionMakers: number;
  activity?: {
    visitCount: number;
    recentVisits: Array<{ id: string; visitDate: string; employee: { id: string; name: string }; hcp?: { id: string; name: string } | null }>;
    meetings: Array<{ id: string; event: MedEvent; hcp: { id: string; name: string } }>;
    openTasks: FollowUpTask[];
  };
}

export interface DashboardData {
  employee: { id: string; name: string; role: string; division: string };
  scope: { employeeCount: number; isManager: boolean };
  asOf: string;
  todayVisits: number;
  week: { weekStart: string; plannedVisits: number; completedVisits: number; completionRate: number | null };
  month: { period: string; visits: number; visitTarget: number; attainmentRate: number | null; salesTarget?: number | null };
  visitTrend14d: { date: string; count: number }[];
  hcpTierDistribution: { A: number; B: number; C: number };
  /** 仅管理岗返回:接收人是我且未评定的拜访数 */
  pendingEvaluations?: number;
}

export interface TerritoryRow {
  employee: { id: string; name: string; division: string; territory?: TerritoryRef | null };
  visitCount: number;
  coveredHcpCount: number;
  aTier: { total: number; covered: number; coverageRate: number | null };
}

export interface TerritoryAnalytics {
  employee: { id: string; name: string; role: string };
  period: string;
  data: TerritoryRow[];
}

/** 客户-代表分配关系(合作代表) */
export interface CustomerAssignment {
  id: string;
  role: string; // OWNER | COLLAB
  employee: {
    id: string;
    name: string;
    role: string;
    employeeCode?: string;
    department?: { id: string; name: string; level: number } | null;
  };
}

/** HCP 教育经历 */
export interface HcpEducation {
  id?: string;
  school?: string | null;
  major?: string | null;
  mentor?: string | null;
  gradDate?: string | null;
  degree?: string | null;
  education?: string | null;
}

/** HCP 银行账户(accountNo 已脱敏) */
export interface HcpBankAccount {
  id?: string;
  accountName?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  accountType?: string | null;
  isDefault?: boolean;
}

/** HCP 列表/详情的扩展档案字段(第三阶段) */
export interface HcpProfileFields {
  gender?: string | null;
  birthday?: string | null;
  licenseNo?: string | null;
  adminDuty?: string | null;
  academicTitle?: string | null;
  doctorLevel?: string | null;
  isMultiPractice?: string | null;
  onlineConsult?: string | null;
  isClinicalPI?: string | null;
  isGroupLeader?: string | null;
  isPharmacyCommittee?: string | null;
  practiceScope?: string | null;
  weeklyOutpatient?: number | null;
  managedBeds?: number | null;
  expertise?: string | null;
  practiceCertNo?: string | null;
  titleCertNo?: string | null;
  email?: string | null;
  hometown?: string | null;
  hobbies?: string | null;
  personalityTags?: string | null;
  homeAddress?: string | null;
  idType?: string | null;
  idNumber?: string | null;
}

/** 国考成绩 */
export interface HcoExamResult {
  id: string;
  year: number;
  grade: string;
  score?: number | null;
  rank?: number | null;
}

/** HCO 科室 */
export interface HcoDepartment {
  id: string;
  name: string;
  standardName?: string | null;
  feature?: string | null;
  ranking?: string | null;
  overview?: string | null;
}

/** HCO 进院产品 / 客户池产品 */
export interface HcoProductItem {
  id: string;
  status: string; // ENTERED | POOL
  product: Product;
}

/** HCO 扩展档案字段(第三阶段) */
export interface HcoProfileFields {
  creditCode?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  otherNames?: string | null;
  businessStatus?: string | null;
  phone?: string | null;
  businessAddress?: string | null;
  category?: string | null;
  regCapital?: string | null;
  foundedDate?: string | null;
  legalPerson?: string | null;
  businessScope?: string | null;
  website?: string | null;
  introduction?: string | null;
  hospitalNature?: string | null;
  institutionType?: string | null;
  isMilitary?: string | null;
  isInsurance?: string | null;
  isClinicalTrial?: string | null;
  isHeadquarters?: string | null;
  teachingType?: string | null;
  diagnosisSubjects?: string | null;
  icuBeds?: number | null;
  openBeds?: number | null;
  approvedBeds?: number | null;
  doctorCount?: number | null;
  annualDrugPurchase?: number | null;
  annualRevenue?: number | null;
  dailyOutpatient?: number | null;
  annualSurgeries?: number | null;
  annualAdmissions?: number | null;
  diseaseAreas?: string | null;
  drugRatio?: number | null;
  isStrategic?: string | null;
  cooperationStatus?: string | null;
  kaOwnerId?: string | null;
  kaOwner?: { id: string; name: string; role: string; employeeCode?: string } | null;
  assignments?: CustomerAssignment[];
}

/** HCO 列表项(含最新国考成绩) */
export type HcoListItem = Hco & HcoProfileFields & { latestExam?: HcoExamResult | null };

/** HCO 360 详情 */
export type HcoDetail = Hco &
  HcoProfileFields & {
    departments: HcoDepartment[];
    hospitalProducts: HcoProductItem[];
    examResults: HcoExamResult[];
    hcps: Hcp[];
    _count?: { visits: number };
  };

/** 分级变更历史 */
export interface TierHistoryItem {
  id: string;
  fromTier?: string | null;
  toTier: string;
  changedById: string;
  reason?: string | null;
  changedAt: string;
}

/** 客户分级统计卡 */
export interface CustomerStats {
  total: number;
  mine: number;
  ungraded: number;
  tierA: number;
  tierB: number;
  tierC: number;
  tierD: number;
}

/** 建档申请 */
export interface CustomerApplication {
  id: string;
  type: string; // HCP_CREATE | HCO_CREATE | HCP_MODIFY | HCO_MODIFY
  payload: string;
  status: string; // DRAFT | PENDING | APPROVED | REJECTED
  applicantId: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
  rejectReason?: string | null;
  targetHcpId?: string | null;
  targetHcoId?: string | null;
  createdHcpId?: string | null;
  createdHcoId?: string | null;
  pool?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** 详情接口附带:payload 解析后的对象 */
  parsedPayload?: Record<string, unknown> | null;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
  /** 分页接口返回(/api/hcp、/api/visits) */
  page?: number;
  pageSize?: number;
}
