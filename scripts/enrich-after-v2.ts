/**
 * enrich-after-v2.ts — 客融CRM 档案体系扩展数据适配(第三阶段)
 * 运行:npm run enrich:v2
 *
 * 在不丢现有业务数据的前提下:
 *  1. HCP:约 92% tier 置 null(未分级),其余按 A/B/C + 少量 D 重新分布;
 *     随机(稳定种子)200 人补工作信息、50 人补教育经历、30 人补银行账户(存原文,API 脱敏)、
 *     100 人补 gender/phone(13x 号段)/email。
 *  2. HCO:全部补 province/city(从名称推断,推断不了给 null);
 *     30 家重点医院补全机构/管理/合作信息;tier 60% 置 null,其余 A/B/C/D;
 *     10 家补 3-5 个科室;15 家补进院产品(已进院 2-3 + 客户池 1-2);8 家补三年国考成绩;
 *     5 家指定 KA 负责人(ASM)。
 *  3. CustomerAssignment 回填:从拜访提炼 (employeeId, hcpId)/(employeeId, hcoId) 去重对 → OWNER;
 *     再给 500 个 HCP 随机加 1 个 COLLAB 代表。
 *  4. CustomerTierHistory:已分级 HCP/HCO 各补 1-2 条历史(changedAt 在 2026-05 ~ 2026-07)。
 *  5. CustomerApplication:3 条样例(1 PENDING HCP_CREATE / 1 DRAFT HCO_CREATE / 1 APPROVED HCP_MODIFY)。
 *  6. 打印全部计数。
 *
 * 幂等性:重复运行前先清空 v2 扩展表(Assignment/TierHistory/Application/教育/账户/科室/进院产品/国考),
 * 再重新生成;HCP/HCO 标量字段为重写式赋值,不产生重复。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 稳定随机数(mulberry32),保证重复运行结果一致
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260724);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// 省市推断
// ---------------------------------------------------------------------------
const JS_CITIES = [
  "南京市", "常州市", "无锡市", "苏州市", "南通市", "盐城市", "泰州市", "扬州市", "镇江市",
  "江阴市", "宜兴市", "张家港市", "常熟市", "靖江市", "昆山市", "启东市", "高邮市", "兴化市",
  "如皋市", "海安市", "泰兴市", "太仓市", "丹阳市", "溧阳市", "东台市", "扬中市", "句容市",
  "仪征市", "淮安市", "宿迁市", "徐州市", "连云港市",
];
const AH_CITIES = [
  "合肥市", "芜湖市", "铜陵市", "阜阳市", "六安市", "滁州市", "马鞍山市", "蚌埠市", "安庆市",
  "亳州市", "宁国市", "宣城市", "广德市", "池州市", "天长市", "无为市", "明光市", "淮北市",
  "宿州市", "界首市", "黄山市",
];
const ZJ_CITIES = ["杭州市", "诸暨市", "宁波市", "温州市"];
const CITY_PROVINCE = new Map<string, string>();
for (const c of JS_CITIES) CITY_PROVINCE.set(c, "江苏省");
for (const c of AH_CITIES) CITY_PROVINCE.set(c, "安徽省");
for (const c of ZJ_CITIES) CITY_PROVINCE.set(c, "浙江省");
CITY_PROVINCE.set("上海市", "上海市");
CITY_PROVINCE.set("南宁市", "广西壮族自治区");

function inferRegion(name: string): { province: string | null; city: string | null } {
  const m = name.match(/^([一-龥]{2,4}市)/);
  if (m) {
    const city = m[1];
    const province = CITY_PROVINCE.get(city);
    if (province) return { province, city };
    // 县级市未知归属时至少保留城市名,省份尝试靠后规则
  }
  // 关键词规则(无城市前缀的名称)
  const kwCity: [string, string, string][] = [
    ["南京", "江苏省", "南京市"], ["鼓楼", "江苏省", "南京市"], ["仙林", "江苏省", "南京市"],
    ["东南大学", "江苏省", "南京市"], ["东部战区", "江苏省", "南京市"], ["浦口", "江苏省", "南京市"],
    ["镇江", "江苏省", "镇江市"], ["常州", "江苏省", "常州市"], ["溧阳", "江苏省", "常州市"],
    ["苏州", "江苏省", "苏州市"], ["无锡", "江苏省", "无锡市"], ["南通", "江苏省", "南通市"],
    ["扬州", "江苏省", "扬州市"], ["泰州", "江苏省", "泰州市"], ["淮安", "江苏省", "淮安市"],
    ["合肥", "安徽省", "合肥市"], ["肥西", "安徽省", "合肥市"], ["肥东", "安徽省", "合肥市"],
    ["芜湖", "安徽省", "芜湖市"], ["皖南", "安徽省", "芜湖市"], ["马鞍山", "安徽省", "马鞍山市"],
    ["诸暨", "浙江省", "诸暨市"],
  ];
  for (const [kw, province, city] of kwCity) {
    if (name.includes(kw)) return { province, city };
  }
  if (name.includes("安徽")) return { province: "安徽省", city: null };
  if (name.includes("江苏")) return { province: "江苏省", city: null };
  if (name.includes("浙江")) return { province: "浙江省", city: null };
  if (name.includes("上海")) return { province: "上海市", city: "上海市" };
  if (m) return { province: null, city: m[1] };
  return { province: null, city: null };
}

// ---------------------------------------------------------------------------
// 生成辅助
// ---------------------------------------------------------------------------
function genPhone(): string {
  const seg = ["0", "1", "3", "5", "7", "8", "9"];
  let s = "13" + pick(seg);
  for (let i = 0; i < 8; i++) s += Math.floor(rand() * 10);
  return s;
}
function genBankAccountNo(): string {
  let s = "6228";
  for (let i = 0; i < 12; i++) s += Math.floor(rand() * 10);
  return s;
}
const DOCTOR_LEVELS = ["主任医师", "副主任医师", "主治医师", "住院医师"];
const ADMIN_DUTIES = ["科主任", "科副主任", "医务处副处长", "病区主任", null];
const EXPERTISE = [
  "肺癌、消化道肿瘤综合治疗", "冠心病介入治疗", "糖尿病及并发症管理", "慢性阻塞性肺疾病",
  "肝癌多学科诊疗", "乳腺癌综合治疗", "高血压规范化管理", "脑卒中二级预防",
];
const SCHOOLS = ["南京医科大学", "安徽医科大学", "苏州大学医学院", "上海交通大学医学院", "浙江大学医学院", "皖南医学院"];
const MAJORS = ["临床医学", "内科学", "肿瘤学", "心血管病学", "呼吸病学"];
const BANKS = ["中国工商银行", "中国建设银行", "中国农业银行", "中国银行", "交通银行", "招商银行"];
const DEPT_POOL = [
  { name: "消化内科", standardName: "消化内科", feature: "消化道早癌筛查与内镜治疗" },
  { name: "肿瘤内科", standardName: "肿瘤内科", feature: "实体瘤综合治疗与靶向治疗" },
  { name: "重症医学科", standardName: "重症医学科", feature: "多器官功能支持" },
  { name: "心血管内科", standardName: "心血管内科", feature: "冠脉介入与心衰管理" },
  { name: "呼吸与危重症医学科", standardName: "呼吸内科", feature: "慢阻肺与肺部感染" },
  { name: "内分泌科", standardName: "内分泌科", feature: "糖尿病一体化管理" },
  { name: "普外科", standardName: "普通外科", feature: "腹腔镜微创手术" },
  { name: "骨科", standardName: "骨科", feature: "关节置换与运动医学" },
];
const EXAM_GRADES = ["A++", "A+", "A", "B++"];

async function main() {
  console.log("== enrich-after-v2 开始 ==");

  // ---------- 0. 清理上次运行产物(幂等) ----------
  const delCounts = await prisma.$transaction([
    prisma.customerAssignment.deleteMany(),
    prisma.customerTierHistory.deleteMany(),
    prisma.customerApplication.deleteMany(),
    prisma.hcpEducation.deleteMany(),
    prisma.hcpBankAccount.deleteMany(),
    prisma.hcoDepartment.deleteMany(),
    prisma.hcoProduct.deleteMany(),
    prisma.hcoExamResult.deleteMany(),
  ]);
  console.log("已清理 v2 扩展表:", delCounts.map((d) => d.count).join("/"));

  const hcps = await prisma.hcp.findMany({ select: { id: true, name: true, tier: true }, orderBy: { id: "asc" } });
  const hcos = await prisma.hco.findMany({ select: { id: true, name: true, level: true }, orderBy: { id: "asc" } });
  const products = await prisma.product.findMany({ select: { id: true } });
  const asms = await prisma.employee.findMany({ where: { role: "ASM" }, select: { id: true } });
  const managers = await prisma.employee.findMany({ where: { role: { in: ["ASM", "RSM"] } }, select: { id: true } });
  console.log(`基础数据:HCP ${hcps.length} / HCO ${hcos.length} / 产品 ${products.length} / ASM ${asms.length}`);

  // ---------- 1. HCP tier 重置:约 92% 未分级 ----------
  // 剩余 8% 按 A 20% / B 45% / C 30% / D 5% 分布
  const tierBuckets = new Map<string | null, string[]>();
  for (const h of hcps) {
    let tier: string | null = null;
    if (rand() >= 0.92) {
      const r = rand();
      tier = r < 0.2 ? "A" : r < 0.65 ? "B" : r < 0.95 ? "C" : "D";
    }
    const list = tierBuckets.get(tier) ?? [];
    list.push(h.id);
    tierBuckets.set(tier, list);
  }
  for (const [tier, ids] of tierBuckets) {
    for (let i = 0; i < ids.length; i += 500) {
      await prisma.hcp.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { tier } });
    }
  }
  const gradedHcpIds = [...(tierBuckets.get("A") ?? []), ...(tierBuckets.get("B") ?? []),
    ...(tierBuckets.get("C") ?? []), ...(tierBuckets.get("D") ?? [])];
  console.log(`HCP 分级:未分级 ${tierBuckets.get(null)?.length ?? 0},已分级 ${gradedHcpIds.length}`,
    `(A=${tierBuckets.get("A")?.length ?? 0} B=${tierBuckets.get("B")?.length ?? 0} C=${tierBuckets.get("C")?.length ?? 0} D=${tierBuckets.get("D")?.length ?? 0})`);

  // ---------- 1b. HCP 补工作信息 / 教育 / 银行账户 / 基础信息 ----------
  const shuffledHcp = shuffle(hcps);
  const work200 = shuffledHcp.slice(0, 200);
  for (const h of work200) {
    await prisma.hcp.update({
      where: { id: h.id },
      data: {
        doctorLevel: pick(DOCTOR_LEVELS),
        adminDuty: pick(ADMIN_DUTIES),
        isPharmacyCommittee: rand() < 0.3 ? "是" : "否",
        weeklyOutpatient: 20 + Math.floor(rand() * 80),
        managedBeds: 5 + Math.floor(rand() * 40),
        expertise: pick(EXPERTISE),
      },
    });
  }
  const edu50 = shuffledHcp.slice(200, 250);
  let eduCount = 0;
  for (const h of edu50) {
    const n = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      await prisma.hcpEducation.create({
        data: {
          hcpId: h.id,
          school: pick(SCHOOLS),
          major: pick(MAJORS),
          mentor: rand() < 0.5 ? pick(["王教授", "李教授", "陈院士", "张教授"]) : null,
          gradDate: `${1995 + Math.floor(rand() * 25)}-07`,
          degree: pick(["博士", "硕士", "学士"]),
          education: pick(["研究生", "本科"]),
        },
      });
      eduCount++;
    }
  }
  const bank30 = shuffledHcp.slice(250, 280);
  for (const h of bank30) {
    await prisma.hcpBankAccount.create({
      data: {
        hcpId: h.id,
        accountName: h.name,
        bankName: pick(BANKS),
        accountNo: genBankAccountNo(), // 存原文,API 层脱敏
        accountType: "借记卡",
        isDefault: true,
      },
    });
  }
  const base100 = shuffledHcp.slice(280, 380);
  for (const h of base100) {
    await prisma.hcp.update({
      where: { id: h.id },
      data: {
        gender: rand() < 0.6 ? "男" : "女",
        phone: genPhone(),
        email: `dr${Math.floor(rand() * 90000 + 10000)}@hospital.example.cn`,
      },
    });
  }
  console.log(`HCP 补充:工作信息 ${work200.length},教育经历 ${eduCount} 条(50 人),银行账户 ${bank30.length},基础信息 ${base100.length}`);

  // ---------- 2. HCO 省市推断 + tier + 重点医院 ----------
  let provinceFilled = 0;
  for (const h of hcos) {
    const { province, city } = inferRegion(h.name);
    if (province) provinceFilled++;
    await prisma.hco.update({ where: { id: h.id }, data: { province, city, district: null } });
  }
  // tier:60% null,其余 A 20% / B 40% / C 30% / D 10%(占已分级部分)
  const hcoTierBuckets = new Map<string | null, string[]>();
  for (const h of hcos) {
    let tier: string | null = null;
    if (rand() >= 0.6) {
      const r = rand();
      tier = r < 0.2 ? "A" : r < 0.6 ? "B" : r < 0.9 ? "C" : "D";
    }
    const list = hcoTierBuckets.get(tier) ?? [];
    list.push(h.id);
    hcoTierBuckets.set(tier, list);
  }
  for (const [tier, ids] of hcoTierBuckets) {
    for (let i = 0; i < ids.length; i += 500) {
      await prisma.hco.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { tier } });
    }
  }
  console.log(`HCO 省市:补全 province ${provinceFilled}/${hcos.length};分级 未分级 ${hcoTierBuckets.get(null)?.length ?? 0},已分级 ${hcos.length - (hcoTierBuckets.get(null)?.length ?? 0)}`);

  // 30 家重点医院(优先三级甲等)
  const key30 = [...hcos.filter((h) => h.level?.includes("三级甲等")), ...hcos.filter((h) => !h.level?.includes("三级甲等"))].slice(0, 30);
  for (const h of key30) {
    await prisma.hco.update({
      where: { id: h.id },
      data: {
        level: h.level ?? "三级甲等",
        hospitalNature: "公立",
        institutionType: "综合医院",
        isMilitary: h.name.includes("军区") || h.name.includes("解放军") || h.name.includes("战区") ? "是" : "否",
        isInsurance: "是",
        isClinicalTrial: rand() < 0.6 ? "是" : "否",
        isHeadquarters: "是",
        openBeds: 2000 + Math.floor(rand() * 1500),
        approvedBeds: 2200 + Math.floor(rand() * 1500),
        icuBeds: 40 + Math.floor(rand() * 80),
        doctorCount: 1500 + Math.floor(rand() * 1000),
        dailyOutpatient: 4000 + Math.floor(rand() * 4000),
        annualSurgeries: 20000 + Math.floor(rand() * 30000),
        annualAdmissions: 60000 + Math.floor(rand() * 50000),
        annualDrugPurchase: Math.round((5 + rand() * 10) * 100) / 100, // 亿元级→万元口径示例值(万元)
        annualRevenue: Math.round((20 + rand() * 40) * 100) / 100,
        drugRatio: Math.round((26 + rand() * 8) * 10) / 10,
        isStrategic: "是",
        category: "目标医院",
        cooperationStatus: "合作",
        businessStatus: "正常",
        tier: "A",
      },
    });
  }
  console.log(`重点医院补全:${key30.length} 家(强制 tier=A, category=目标医院, isStrategic=是)`);

  // 10 家补科室(3-5 个)
  let deptCount = 0;
  for (const h of key30.slice(0, 10)) {
    const depts = shuffle(DEPT_POOL).slice(0, 3 + Math.floor(rand() * 3));
    for (const d of depts) {
      await prisma.hcoDepartment.create({
        data: {
          hcoId: h.id,
          name: d.name,
          standardName: d.standardName,
          feature: d.feature,
          ranking: rand() < 0.4 ? `省内前${1 + Math.floor(rand() * 10)}` : null,
          overview: `${h.name}${d.name}成立于上世纪,为医院重点学科之一,${d.feature}。`,
        },
      });
      deptCount++;
    }
  }
  // 15 家补进院产品(已进院 2-3 + 客户池 1-2)
  let hcoProductCount = 0;
  for (const h of key30.slice(0, 15)) {
    const ps = shuffle(products.map((p) => p.id));
    const entered = ps.slice(0, 2 + Math.floor(rand() * 2));
    const pool = ps.slice(entered.length, entered.length + 1 + Math.floor(rand() * 2));
    for (const pid of entered) {
      await prisma.hcoProduct.create({ data: { hcoId: h.id, productId: pid, status: "ENTERED" } });
      hcoProductCount++;
    }
    for (const pid of pool) {
      await prisma.hcoProduct.create({ data: { hcoId: h.id, productId: pid, status: "POOL" } });
      hcoProductCount++;
    }
  }
  // 8 家补三年国考成绩(2023/2024/2025,等级逐年微升)
  let examCount = 0;
  for (const h of key30.slice(0, 8)) {
    const base = Math.floor(rand() * 3); // 起始等级下标
    for (const [i, year] of [2023, 2024, 2025].entries()) {
      const grade = EXAM_GRADES[Math.max(0, base - i)] ?? "A";
      await prisma.hcoExamResult.create({
        data: {
          hcoId: h.id,
          year,
          grade,
          score: Math.round((700 + rand() * 200) * 10) / 10,
          rank: 1 + Math.floor(rand() * 200),
        },
      });
      examCount++;
    }
  }
  // 5 家指定 KA 负责人(ASM)
  for (const [i, h] of key30.slice(0, 5).entries()) {
    await prisma.hco.update({ where: { id: h.id }, data: { kaOwnerId: asms[i % asms.length].id } });
  }
  console.log(`HCO 子档案:科室 ${deptCount},进院产品 ${hcoProductCount},国考成绩 ${examCount},KA 负责人 5`);

  // ---------- 3. CustomerAssignment 回填 ----------
  const visitPairs = await prisma.visit.findMany({
    where: { hcpId: { not: null } },
    select: { employeeId: true, hcpId: true },
    distinct: ["employeeId", "hcpId"],
  });
  const hcoPairs = await prisma.visit.findMany({
    where: { hcoId: { not: null } },
    select: { employeeId: true, hcoId: true },
    distinct: ["employeeId", "hcoId"],
  });
  const assignmentRows = [
    ...visitPairs.map((p) => ({ employeeId: p.employeeId, hcpId: p.hcpId!, role: "OWNER" })),
    ...hcoPairs.map((p) => ({ employeeId: p.employeeId, hcoId: p.hcoId!, role: "OWNER" })),
  ];
  for (let i = 0; i < assignmentRows.length; i += 2000) {
    await prisma.customerAssignment.createMany({ data: assignmentRows.slice(i, i + 2000) });
  }
  console.log(`Assignment 回填:HCP-OWNER ${visitPairs.length},HCO-OWNER ${hcoPairs.length}`);

  // 500 个 HCP 加 1 个 COLLAB 代表(不与已有 OWNER 重复)
  const ownerByHcp = new Map<string, Set<string>>();
  for (const p of visitPairs) {
    const set = ownerByHcp.get(p.hcpId!) ?? new Set<string>();
    set.add(p.employeeId);
    ownerByHcp.set(p.hcpId!, set);
  }
  const allEmployeeIds = (await prisma.employee.findMany({ where: { role: "MR" }, select: { id: true } })).map((e) => e.id);
  const collabTargets = shuffle(hcps.map((h) => h.id)).slice(0, 500);
  let collabCount = 0;
  for (const hcpId of collabTargets) {
    const owners = ownerByHcp.get(hcpId) ?? new Set<string>();
    const candidates = allEmployeeIds.filter((e) => !owners.has(e));
    if (!candidates.length) continue;
    await prisma.customerAssignment.create({
      data: { hcpId, employeeId: pick(candidates), role: "COLLAB" },
    });
    collabCount++;
  }
  console.log(`COLLAB 分配:${collabCount}`);

  // ---------- 4. CustomerTierHistory ----------
  // 已分级 HCP/HCO 各补 1-2 条(末条 toTier=当前分级),changedAt 在 2026-05 ~ 2026-07
  const hcpTierNow = new Map<string, string>();
  for (const [tier, ids] of tierBuckets) {
    if (tier) for (const id of ids) hcpTierNow.set(id, tier);
  }
  const hcoTierNow = new Map<string, string>();
  for (const [tier, ids] of hcoTierBuckets) {
    if (tier) for (const id of ids) hcoTierNow.set(id, tier);
  }
  for (const h of key30) hcoTierNow.set(h.id, "A");
  const PREV: Record<string, string> = { A: "B", B: "C", C: "D", D: "C" };
  const tierHistoryRows: {
    hcpId?: string; hcoId?: string; fromTier: string | null; toTier: string;
    changedById: string; reason: string | null; changedAt: Date;
  }[] = [];
  const randomDay = (month: number) => new Date(2026, month - 1, 1 + Math.floor(rand() * 28), 10, 0, 0);
  const pushHistory = (key: "hcpId" | "hcoId", id: string, toTier: string) => {
    const entries = 1 + Math.floor(rand() * 2);
    if (entries === 2) {
      tierHistoryRows.push({
        [key]: id, fromTier: null, toTier: PREV[toTier],
        changedById: pick(managers).id, reason: "年度客户梳理,初次分级",
        changedAt: randomDay(5),
      });
    }
    tierHistoryRows.push({
      [key]: id, fromTier: entries === 2 ? PREV[toTier] : null, toTier,
      changedById: pick(managers).id,
      reason: toTier === "A" ? "销量与学术影响力提升,升级重点客户" : "季度分级复盘调整",
      changedAt: randomDay(6 + Math.floor(rand() * 2)),
    });
  };
  for (const [id, tier] of hcpTierNow) pushHistory("hcpId", id, tier);
  for (const [id, tier] of hcoTierNow) pushHistory("hcoId", id, tier);
  for (let i = 0; i < tierHistoryRows.length; i += 2000) {
    await prisma.customerTierHistory.createMany({ data: tierHistoryRows.slice(i, i + 2000) });
  }
  console.log(`TierHistory:${tierHistoryRows.length}(HCP ${hcpTierNow.size} 客户 / HCO ${hcoTierNow.size} 机构)`);

  // ---------- 5. CustomerApplication 样例 ----------
  const applicant = asms[0].id;
  const reviewer = managers[managers.length - 1].id;
  // 5.1 HCP_CREATE PENDING(payload 完整含教育/账户)
  await prisma.customerApplication.create({
    data: {
      type: "HCP_CREATE",
      status: "PENDING",
      applicantId: applicant,
      pool: "架构客户池",
      payload: JSON.stringify({
        name: "沈砚秋", title: "主任医师", specialty: "消化内科", gender: "女",
        doctorLevel: "主任医师", adminDuty: "科主任", isPharmacyCommittee: "是",
        weeklyOutpatient: 60, managedBeds: 30, expertise: "消化道早癌内镜诊治",
        phone: "13912345678", email: "shenyq@hospital.example.cn",
        hcoId: key30[0].id,
        educations: [
          { school: "南京医科大学", major: "临床医学", degree: "学士", education: "本科", gradDate: "2003-07" },
          { school: "上海交通大学医学院", major: "内科学", degree: "博士", education: "研究生", mentor: "陈院士", gradDate: "2010-07" },
        ],
        bankAccounts: [
          { accountName: "沈砚秋", bankName: "中国工商银行", accountNo: "6222021001118888777", accountType: "借记卡", isDefault: true },
        ],
      }),
    },
  });
  // 5.2 HCO_CREATE DRAFT
  await prisma.customerApplication.create({
    data: {
      type: "HCO_CREATE",
      status: "DRAFT",
      applicantId: applicant,
      pool: "业绩客户池",
      payload: JSON.stringify({
        name: "苏州市吴中区康养人民医院", type: "HOSPITAL", level: "二级甲等",
        province: "江苏省", city: "苏州市", district: "吴中区",
        hospitalNature: "公立", institutionType: "综合医院", category: "观察医院",
        openBeds: 600, doctorCount: 320, dailyOutpatient: 1200,
      }),
    },
  });
  // 5.3 HCP_MODIFY APPROVED(带 reviewer)
  const modifyTarget = hcps[0];
  await prisma.customerApplication.create({
    data: {
      type: "HCP_MODIFY",
      status: "APPROVED",
      applicantId: applicant,
      reviewerId: reviewer,
      reviewedAt: new Date(2026, 6, 20, 15, 0, 0),
      targetHcpId: modifyTarget.id,
      createdHcpId: modifyTarget.id,
      payload: JSON.stringify({ adminDuty: "科副主任", isPharmacyCommittee: "是" }),
    },
  });
  console.log("Application 样例:3 条(1 PENDING HCP_CREATE / 1 DRAFT HCO_CREATE / 1 APPROVED HCP_MODIFY)");

  // ---------- 6. 最终计数 ----------
  const counts = {
    visit: await prisma.visit.count(),
    hcp: await prisma.hcp.count(),
    hco: await prisma.hco.count(),
    employee: await prisma.employee.count(),
    hcpUngraded: await prisma.hcp.count({ where: { tier: null } }),
    hcoUngraded: await prisma.hco.count({ where: { tier: null } }),
    hcpEducation: await prisma.hcpEducation.count(),
    hcpBankAccount: await prisma.hcpBankAccount.count(),
    hcoDepartment: await prisma.hcoDepartment.count(),
    hcoProduct: await prisma.hcoProduct.count(),
    hcoExamResult: await prisma.hcoExamResult.count(),
    assignment: await prisma.customerAssignment.count(),
    assignmentOwner: await prisma.customerAssignment.count({ where: { role: "OWNER" } }),
    assignmentCollab: await prisma.customerAssignment.count({ where: { role: "COLLAB" } }),
    tierHistory: await prisma.customerTierHistory.count(),
    application: await prisma.customerApplication.count(),
  };
  console.log("== enrich-after-v2 完成,最终计数 ==");
  console.table(counts);
}

main()
  .catch((e) => {
    console.error("enrich-after-v2 失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
