/**
 * Pharma SFA 种子数据
 * 时间基准:2026-07-24(本周 = 2026-07-20 所在周,本月 = 2026-07)
 * 运行:npx prisma db seed
 *
 * 对照外部 CRM 导出格式补全:
 * 五级部门树、员工工号、HCP/HCO 编码、结构化拜访目的(purposes)、人工总结(summary)、
 * 数据来源(source)、报告接收人(receiverId)、有效性评定(validityStatus 等)、签到(CheckIn)。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 可复现的伪随机数 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260724);
const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;

const REF_NOW = new Date("2026-07-24T17:00:00+08:00");
const day = (offsetFromRef: number, hour = 9, minute = 0) => {
  const d = new Date(REF_NOW);
  d.setDate(d.getDate() + offsetFromRef);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** 按真实分布生成 purposes 数组:产品信息传递为主,常与临床信息沟通组合 */
function genPurposes(): string[] {
  const r = rng();
  if (r < 0.42) return ["产品信息传递"];
  if (r < 0.68) return ["产品信息传递", "临床信息沟通"];
  if (r < 0.78) return ["临床信息沟通"];
  if (r < 0.86) return ["产品信息传递", "市场现状调研"];
  if (r < 0.93) return ["学术会议沟通"];
  if (r < 0.97) return ["市场现状调研"];
  return ["其他"];
}

async function main() {
  console.log("清空旧数据...");
  await prisma.intelligenceUsage.deleteMany();
  await prisma.intelligenceCompetitor.deleteMany();
  await prisma.intelligenceTherapeuticArea.deleteMany();
  await prisma.intelligenceProduct.deleteMany();
  await prisma.salesIntelligence.deleteMany();
  await prisma.collectionRun.deleteMany();
  await prisma.competitorProduct.deleteMany();
  await prisma.intelligenceSource.deleteMany();
  await prisma.mcpOperation.deleteMany();
  await prisma.visitMaterialUsage.deleteMany();
  await prisma.productMaterial.deleteMany();
  await prisma.salesResult.deleteMany();
  await prisma.salesImportBatch.deleteMany();
  await prisma.accountMilestone.deleteMany();
  await prisma.accountStakeholder.deleteMany();
  await prisma.accountPlanProduct.deleteMany();
  await prisma.accountPlan.deleteMany();
  await prisma.cyclePlanItem.deleteMany();
  await prisma.cyclePlan.deleteMany();
  await prisma.followUpTask.deleteMany();
  await prisma.coachingAction.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.medEvent.deleteMany();
  await prisma.sampleTransaction.deleteMany();
  await prisma.sampleLot.deleteMany();
  await prisma.visitProduct.deleteMany();
  await prisma.tourPlanItem.deleteMany();
  await prisma.tourPlan.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.target.deleteMany();
  await prisma.customerAssignment.deleteMany();
  await prisma.hcpAffiliation.deleteMany();
  await prisma.hcp.deleteMany();
  await prisma.hco.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.territory.deleteMany();

  // ---------- 五级部门树(行政组织,独立于 Territory 辖区) ----------
  console.log("创建五级部门树...");
  const deptBU = await prisma.department.create({ data: { name: "综合创新产品事业部", level: 1 } });
  const deptZone = await prisma.department.create({ data: { name: "中部战区A", level: 2, parentId: deptBU.id } });
  const deptSub = await prisma.department.create({ data: { name: "苏皖分管区A", level: 3, parentId: deptZone.id } });
  const deptNanjing = await prisma.department.create({ data: { name: "南京区A", level: 4, parentId: deptSub.id } });
  const deptSunan = await prisma.department.create({ data: { name: "苏南区A", level: 4, parentId: deptSub.id } });
  const deptOfficeNJ1 = await prisma.department.create({ data: { name: "南京一办事处", level: 5, parentId: deptNanjing.id } });
  const deptOfficeNJ2 = await prisma.department.create({ data: { name: "南京二办事处", level: 5, parentId: deptNanjing.id } });
  const deptOfficeSZ = await prisma.department.create({ data: { name: "苏州办事处A", level: 5, parentId: deptSunan.id } });
  const deptOfficeWX = await prisma.department.create({ data: { name: "无锡办事处A", level: 5, parentId: deptSunan.id } });

  // ---------- 辖区树:华东大区 → 2 地区 → 各 2 办事处 ----------
  console.log("创建辖区树...");
  const zone = await prisma.territory.create({ data: { name: "华东大区", level: "ZONE" } });
  const regionSunan = await prisma.territory.create({ data: { name: "苏南地区", level: "REGION", parentId: zone.id } });
  const regionZhebei = await prisma.territory.create({ data: { name: "浙北地区", level: "REGION", parentId: zone.id } });
  const areaSuzhou = await prisma.territory.create({ data: { name: "苏州办事处", level: "AREA", parentId: regionSunan.id } });
  const areaWuxi = await prisma.territory.create({ data: { name: "无锡办事处", level: "AREA", parentId: regionSunan.id } });
  const areaHangzhou = await prisma.territory.create({ data: { name: "杭州办事处", level: "AREA", parentId: regionZhebei.id } });
  const areaJiaxing = await prisma.territory.create({ data: { name: "嘉兴办事处", level: "AREA", parentId: regionZhebei.id } });

  // ---------- 销售组织 9 人(工号 YG1001-YG1009,全部挂到办事处) ----------
  console.log("创建销售组织...");
  const rsm = await prisma.employee.create({
    data: { employeeCode: "YG1001", name: "王建国", role: "RSM", division: "肿瘤线", phone: "13800000001", territoryId: zone.id, departmentId: deptOfficeNJ1.id },
  });
  const asmOnc = await prisma.employee.create({
    data: { employeeCode: "YG1002", name: "李强", role: "ASM", division: "肿瘤线", phone: "13800000002", reportsToId: rsm.id, territoryId: regionSunan.id, departmentId: deptOfficeSZ.id },
  });
  const asmCvd = await prisma.employee.create({
    data: { employeeCode: "YG1003", name: "赵敏", role: "ASM", division: "心血管线", phone: "13800000003", reportsToId: rsm.id, territoryId: regionZhebei.id, departmentId: deptOfficeNJ2.id },
  });

  const mrDefs = [
    { code: "YG1004", name: "张伟", division: "肿瘤线", boss: asmOnc.id, territoryId: areaSuzhou.id, deptId: deptOfficeSZ.id, phone: "13800000011" },
    { code: "YG1005", name: "陈静", division: "肿瘤线", boss: asmOnc.id, territoryId: areaWuxi.id, deptId: deptOfficeWX.id, phone: "13800000012" },
    { code: "YG1006", name: "刘洋", division: "肿瘤线", boss: asmOnc.id, territoryId: areaSuzhou.id, deptId: deptOfficeSZ.id, phone: "13800000013" },
    { code: "YG1007", name: "孙磊", division: "心血管线", boss: asmCvd.id, territoryId: areaHangzhou.id, deptId: deptOfficeNJ1.id, phone: "13800000014" },
    { code: "YG1008", name: "周婷", division: "心血管线", boss: asmCvd.id, territoryId: areaJiaxing.id, deptId: deptOfficeWX.id, phone: "13800000015" },
    { code: "YG1009", name: "吴磊", division: "心血管线", boss: asmCvd.id, territoryId: areaHangzhou.id, deptId: deptOfficeNJ2.id, phone: "13800000016" },
  ];
  const mrs: { id: string; name: string; division: string; territoryId: string; bossId: string }[] = [];
  for (const m of mrDefs) {
    const e = await prisma.employee.create({
      data: { employeeCode: m.code, name: m.name, role: "MR", division: m.division, phone: m.phone, reportsToId: m.boss, territoryId: m.territoryId, departmentId: m.deptId },
    });
    mrs.push({ id: e.id, name: e.name, division: e.division, territoryId: m.territoryId, bossId: m.boss });
  }

  // ---------- 医疗机构:8 医院 + 2 药店 + 1 商业公司(编码 HOS001+) ----------
  console.log("创建医疗机构...");
  const hcoDefs = [
    { name: "苏州大学附属第一医院", type: "HOSPITAL", level: "三级甲等", address: "苏州市姑苏区十梓街188号", territoryId: areaSuzhou.id },
    { name: "苏州市立医院", type: "HOSPITAL", level: "三级甲等", address: "苏州市姑苏区道前街26号", territoryId: areaSuzhou.id },
    { name: "苏州九龙医院", type: "HOSPITAL", level: "三级乙等", address: "苏州市工业园区万盛街118号", territoryId: areaSuzhou.id },
    { name: "无锡市人民医院", type: "HOSPITAL", level: "三级甲等", address: "无锡市梁溪区清扬路299号", territoryId: areaWuxi.id },
    { name: "浙江大学医学院附属第一医院", type: "HOSPITAL", level: "三级甲等", address: "杭州市上城区庆春路79号", territoryId: areaHangzhou.id },
    { name: "浙江省肿瘤医院", type: "HOSPITAL", level: "三级甲等", address: "杭州市拱墅区半山东路1号", territoryId: areaHangzhou.id },
    { name: "杭州市第一人民医院", type: "HOSPITAL", level: "三级甲等", address: "杭州市上城区浣纱路261号", territoryId: areaHangzhou.id },
    { name: "嘉兴市第二医院", type: "HOSPITAL", level: "二级甲等", address: "嘉兴市南湖区环城北路1518号", territoryId: areaJiaxing.id },
    { name: "苏州雷允上药城南门店", type: "PHARMACY", level: null, address: "苏州市姑苏区人民路1024号", territoryId: areaSuzhou.id },
    { name: "杭州华东大药房总店", type: "PHARMACY", level: null, address: "杭州市下城区延安路258号", territoryId: areaHangzhou.id },
    { name: "华东医药股份有限公司", type: "DISTRIBUTOR", level: null, address: "杭州市拱墅区莫干山路866号", territoryId: areaHangzhou.id },
  ];
  const hcos: { id: string; name: string }[] = [];
  for (let i = 0; i < hcoDefs.length; i++) {
    const rec = await prisma.hco.create({ data: { ...hcoDefs[i], code: `HOS${String(i + 1).padStart(3, "0")}` } });
    hcos.push({ id: rec.id, name: rec.name });
  }
  for (let index = 0; index < 3; index++) {
    await prisma.hco.update({
      where: { id: hcos[index].id },
      data: { isStrategic: "是", cooperationStatus: "合作", kaOwnerId: mrs[index].id },
    });
  }

  // ---------- 30 位医生 HCP(A:B:C = 6:15:9,编码 DR0001+) ----------
  console.log("创建 HCP...");
  // [name, title, specialty, tier, hcoIndex, tags?]
  const hcpDefs: [string, string, string, string, number, string?][] = [
    // 肿瘤线 16 人
    ["张明远", "主任医师", "肿瘤内科", "A", 0, "KOL,肺癌领域"],
    ["李慧敏", "主任医师", "肿瘤内科", "A", 5, "KOL,乳腺癌领域"],
    ["王志强", "副主任医师", "胸外科", "A", 1, null as unknown as string],
    ["陈国华", "主任医师", "呼吸与危重症医学科", "A", 4, "KOL,肺癌领域"],
    ["何俊杰", "副主任医师", "肿瘤内科", "A", 3, "KOL,消化道肿瘤"],
    ["刘晓燕", "副主任医师", "肿瘤内科", "B", 1],
    ["赵铁柱", "主治医师", "肿瘤内科", "B", 0],
    ["孙雅婷", "副主任医师", "放疗科", "B", 5],
    ["周建军", "主治医师", "胸外科", "B", 3],
    ["吴丽萍", "副主任医师", "肿瘤内科", "B", 6],
    ["郑海涛", "主治医师", "呼吸与危重症医学科", "B", 4],
    ["马晓东", "主治医师", "肿瘤内科", "B", 2],
    ["罗秀英", "主治医师", "肿瘤内科", "C", 7],
    ["高文博", "住院医师", "肿瘤内科", "C", 2],
    ["林晓峰", "主治医师", "放疗科", "C", 5],
    ["徐丽丽", "住院医师", "胸外科", "C", 1],
    // 心血管线 14 人
    ["杨国栋", "主任医师", "心血管内科", "A", 4, "KOL,心衰领域"],
    ["黄美玲", "主任医师", "心血管内科", "B", 1],
    ["朱建华", "副主任医师", "心血管内科", "B", 0],
    ["秦海峰", "副主任医师", "心脏大血管外科", "B", 3],
    ["许文静", "主治医师", "心血管内科", "B", 6],
    ["韩雪梅", "副主任医师", "老年医学科", "B", 6],
    ["董建军", "主治医师", "心血管内科", "B", 3],
    ["蒋晓东", "副主任医师", "心血管内科", "B", 4],
    ["潘丽君", "主治医师", "心血管内科", "B", 2],
    ["谢天成", "主治医师", "心血管内科", "C", 7],
    ["曹永强", "主治医师", "心血管内科", "C", 2],
    ["彭丽娟", "住院医师", "心血管内科", "C", 7],
    ["沈玉梅", "主治医师", "心血管内科", "C", 1],
    ["崔志远", "住院医师", "心血管内科", "C", 6],
  ];
  const oncSpecialties = new Set(["肿瘤内科", "胸外科", "呼吸与危重症医学科", "放疗科"]);
  const hcps: { id: string; name: string; tier: string; division: string; hcoId: string }[] = [];
  for (let i = 0; i < hcpDefs.length; i++) {
    const [name, title, specialty, tier, hcoIdx, tags] = hcpDefs[i];
    const rec = await prisma.hcp.create({
      data: {
        code: `DR${String(i + 1).padStart(4, "0")}`,
        name,
        title,
        specialty,
        tier,
        hcoId: hcos[hcoIdx].id,
        phone: chance(0.7) ? `139${String(randInt(10000000, 99999999))}` : null,
        wechat: chance(0.5) ? `wx_${name}` : null,
        tags: tags ?? null,
        notes: chance(0.3) ? pick(["重视循证证据,沟通需带文献", "门诊量大,拜访宜早到", "对价格敏感,关注医保政策"]) : null,
      },
    });
    hcps.push({
      id: rec.id,
      name: rec.name,
      tier,
      hcoId: hcos[hcoIdx].id,
      division: oncSpecialties.has(specialty) ? "肿瘤线" : "心血管线",
    });
  }

  console.log("创建 HCP 任职经历...");
  for (let i = 0; i < hcps.length; i++) {
    const [, title, specialty, , hcoIdx] = hcpDefs[i];
    await prisma.hcpAffiliation.create({
      data: {
        hcpId: hcps[i].id,
        hcoId: hcos[hcoIdx].id,
        departmentName: specialty,
        title,
        adminDuty: i === 0 ? "科主任" : null,
        isPrimary: true,
        effectiveDate: new Date("2025-01-01T00:00:00+08:00"),
      },
    });
  }
  await prisma.hcpAffiliation.create({
    data: {
      hcpId: hcps[0].id,
      hcoId: hcos[1].id,
      departmentName: "肿瘤中心",
      title: "特聘主任医师",
      adminDuty: "多学科诊疗顾问",
      effectiveDate: new Date("2026-03-01T00:00:00+08:00"),
    },
  });
  await prisma.hcpAffiliation.create({
    data: {
      hcpId: hcps[1].id,
      hcoId: hcos[0].id,
      departmentName: "乳腺外科",
      title: "副主任医师",
      adminDuty: null,
      effectiveDate: new Date("2022-01-01T00:00:00+08:00"),
      endDate: new Date("2024-12-31T00:00:00+08:00"),
    },
  });

  // ---------- HCP 负责人归属:同事业部内确定性轮转 ----------
  console.log("创建客户负责人归属...");
  const ownerAssignments: Array<{ hcpId: string; employeeId: string }> = [];
  for (const division of ["肿瘤线", "心血管线"]) {
    const divisionMrs = mrs.filter((mr) => mr.division === division);
    hcps.filter((hcp) => hcp.division === division).forEach((hcp, index) => {
      ownerAssignments.push({ hcpId: hcp.id, employeeId: divisionMrs[index % divisionMrs.length].id });
    });
  }
  await prisma.customerAssignment.createMany({
    data: ownerAssignments.map((assignment) => ({ ...assignment, role: "OWNER" })),
  });

  // ---------- 6 个产品 ----------
  console.log("创建产品...");
  const productDefs = [
    { brand: "安瑞泽", molecule: "奥希替尼", therapeuticCategory: "肺癌靶向治疗", division: "肿瘤线", price: 5580, unit: "80mg*30片/盒" },
    { brand: "博立康", molecule: "贝伐珠单抗", therapeuticCategory: "抗血管生成治疗", division: "肿瘤线", price: 1998, unit: "100mg(4ml)/瓶" },
    { brand: "泰瑞宁", molecule: "阿美替尼", therapeuticCategory: "肺癌靶向治疗", division: "肿瘤线", price: 3520, unit: "55mg*20片/盒" },
    { brand: "心悦达", molecule: "沙库巴曲缬沙坦钠", therapeuticCategory: "心力衰竭", division: "心血管线", price: 286, unit: "100mg*14片/盒" },
    { brand: "脉舒平", molecule: "瑞舒伐他汀", therapeuticCategory: "血脂异常", division: "心血管线", price: 78, unit: "10mg*28片/盒" },
    { brand: "康脉宁", molecule: "替格瑞洛", therapeuticCategory: "抗血小板治疗", division: "心血管线", price: 168, unit: "90mg*14片/盒" },
  ];
  const products: { id: string; brand: string; molecule: string; therapeuticCategory: string; division: string; price: number }[] = [];
  for (const p of productDefs) {
    const rec = await prisma.product.create({ data: p });
    products.push({ id: rec.id, brand: rec.brand, molecule: rec.molecule, therapeuticCategory: rec.therapeuticCategory, division: rec.division, price: rec.price ?? 0 });
  }

  // ---------- 样品批次:每个产品 1-2 个 ----------
  console.log("创建样品批次...");
  const lots: { id: string; productId: string; lotNumber: string }[] = [];
  for (const p of products) {
    const lotCount = randInt(1, 2);
    for (let i = 0; i < lotCount; i++) {
      const rec = await prisma.sampleLot.create({
        data: {
          productId: p.id,
          lotNumber: `LOT-${p.brand.slice(0, 1)}${randInt(202600, 202699)}-${i + 1}`,
          expiryDate: new Date(`2027-${String(randInt(3, 12)).padStart(2, "0")}-28T00:00:00+08:00`),
          totalQty: randInt(500, 2000),
        },
      });
      lots.push({ id: rec.id, productId: rec.productId, lotNumber: rec.lotNumber });
    }
  }

  // ---------- 样品领用:每个代表 × 本事业部每个产品 ----------
  console.log("创建样品领用记录...");
  for (const mr of mrs) {
    const myProducts = products.filter((p) => p.division === mr.division);
    for (const p of myProducts) {
      const lot = lots.find((l) => l.productId === p.id)!;
      await prisma.sampleTransaction.create({
        data: {
          lotId: lot.id,
          employeeId: mr.id,
          quantity: randInt(80, 120),
          type: "RECEIVE",
          transDate: day(-23, 10), // 2026-07-01
        },
      });
    }
  }

  // ---------- 六个月销售结果：稳定增长 / 延迟改善 / 持续未达 ----------
  console.log("创建月度销售结果...");
  const salesRates = [
    [0.72, 0.78, 0.84, 0.91, 0.98, 1.06],
    [0.70, 0.69, 0.71, 0.73, 0.88, 0.96],
    [0.66, 0.64, 0.62, 0.68, 0.70, 0.72],
  ];
  const salesRows = [];
  for (let scenarioIndex = 0; scenarioIndex < 3; scenarioIndex++) {
    const employee = mrs[scenarioIndex];
    const product = products.filter((item) => item.division === employee.division)[scenarioIndex];
    const hco = hcos[scenarioIndex];
    for (let monthIndex = 0; monthIndex < 6; monthIndex++) {
      const targetAmountCents = (9000000 + scenarioIndex * 1500000 + monthIndex * 300000);
      const actualAmountCents = Math.round(targetAmountCents * salesRates[scenarioIndex][monthIndex]);
      const targetQuantity = 1000 + scenarioIndex * 200 + monthIndex * 30;
      salesRows.push({
        month: new Date(Date.UTC(2026, 1 + monthIndex, 1) - 8 * 60 * 60 * 1000),
        productId: product.id,
        hcoId: hco.id,
        employeeId: employee.id,
        targetAmountCents,
        actualAmountCents,
        targetQuantity,
        actualQuantity: Math.round(targetQuantity * salesRates[scenarioIndex][monthIndex]),
      });
    }
  }
  await prisma.salesResult.createMany({ data: salesRows });

  // ---------- 2026-07 月度 Cycle Plan:按客户分级生成目标快照 ----------
  console.log("创建月度客户覆盖计划...");
  const cycleMonth = new Date("2026-07-01T00:00:00+08:00");
  const tierFrequency: Record<string, number> = { A: 4, B: 2, C: 1, D: 0 };
  for (const mr of mrs) {
    const myAssignments = ownerAssignments.filter((assignment) => assignment.employeeId === mr.id);
    await prisma.cyclePlan.create({
      data: {
        employeeId: mr.id,
        createdById: mr.bossId,
        month: cycleMonth,
        frequencyA: 4,
        frequencyB: 2,
        frequencyC: 1,
        frequencyD: 0,
        items: {
          create: myAssignments.map((assignment) => {
            const hcp = hcps.find((candidate) => candidate.id === assignment.hcpId)!;
            return { hcpId: hcp.id, tierSnapshot: hcp.tier, targetVisits: tierFrequency[hcp.tier] ?? 0 };
          }),
        },
      },
    });
  }

  // ---------- 拜访数据:近 14 天,每个 MR 每天 4-8 条 ----------
  console.log("创建拜访记录(约 500 条,含签到/有效性评定,需几秒钟)...");
  const outcomes = ["同意试用", "需进一步跟进", "已处方,反馈良好", "态度保守,继续观察", "约定下次文献拜访", "答应参加学术会议"];
  const oncNotes = [
    "{n}对三代TKI耐药后线数据感兴趣,约了下周带文献",
    "聊到FLAURA2研究,{n}认为PFS数据不错但担心联合方案毒性",
    "{n}反馈目前一线还是习惯用化疗+免疫,靶向用的少,需要再教育",
    "送了{brand}的说明书和DA,{n}答应在合适病人上试试",
    "{n}问起{brand}进院进度,药剂科还在走流程,持续跟进",
    "门诊遇到{n},简单聊了10分钟,他最近在写一个肺癌回顾性研究,可能可以合作",
    "{n}提到竞品代表上周来过,送了检测服务,我们要加快NGS检测的落地支持",
    "协同拜访,{n}对脑转移患者的治疗策略讨论很深入",
  ];
  const cvdNotes = [
    "{n}关注ARNI在心衰合并低血压患者中的剂量滴定,答应整理病例讨论",
    "{n}反馈{brand}医保报销后患者负担可以接受,依从性比以前好",
    "聊了血脂管理新指南,{n}对强化他汀联合依折麦布的方案认可",
    "{n}问{brand}和氯吡格雷相比在ACS后的优选人群,约了下周带GRACE评分资料",
    "晨访碰到{n}查房,简单问候,约好下午再详谈",
    "{n}科室最近收了好几个难治性心衰,讨论了GDMT优化路径",
    "协同经理拜访{n},谈了科室会的事情,初步定在月底",
  ];
  const summaryTemplates = [
    "本次拜访主要向{n}传递了{brand}的核心产品信息,医生接受度较好,约定下次继续跟进。",
    "与{n}沟通了{brand}的最新临床数据,医生提出了几个安全性方面的问题,已现场解答,后续带文献回访。",
    "{n}目前在同类患者上仍以竞品为主,本次重点做了差异化对比,医生态度有所松动,需持续跟进。",
    "例行随访{n},了解了近期处方情况和患者反馈,整体平稳,无不良反应上报。",
    "向{n}介绍了科室会的初步方案,医生愿意作为讲者参与,具体日期待与科室确认。",
    "本次拜访时间较短,主要维护了客情,简单同步了{brand}的医保政策进展。",
  ];
  const nextSteps = [
    "下周三带最新III期数据文献回访",
    "月底前安排科室会讲者确认",
    "跟进药剂科进药流程,两周内再约药事会",
    "把DA和患者教育手册各送10份",
    "约{n}参加下月城市会",
    "微信推送最新指南解读文章",
  ];
  const invalidReasons = ["重复拜访记录", "内容过短", "签到地点不对", "结果未体现"];
  const sentiments = ["POSITIVE", "NEUTRAL", "NEUTRAL", "NEGATIVE"];

  let visitCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let pendingCount = 0;
  let mismatchCount = 0;
  for (const mr of mrs) {
    const myProducts = products.filter((p) => p.division === mr.division);
    const myHcps = hcps.filter((h) => h.division === mr.division);
    const notePool = mr.division === "肿瘤线" ? oncNotes : cvdNotes;

    for (let d = -13; d <= 0; d++) {
      const dayCount = randInt(4, 8);
      for (let v = 0; v < dayCount; v++) {
        const hcp = pick(myHcps);
        const type = pick([
          "FACE_TO_FACE", "FACE_TO_FACE", "FACE_TO_FACE", "FACE_TO_FACE", "FACE_TO_FACE", "FACE_TO_FACE",
          "PHONE", "PHONE", "CONFERENCE", "JOINT",
        ]);
        const productCount = randInt(1, 2);
        const visitProducts = [...myProducts].sort(() => rng() - 0.5).slice(0, productCount);
        const notes = pick(notePool)
          .replaceAll("{n}", hcp.name + (chance(0.6) ? "主任" : "医生"))
          .replaceAll("{brand}", pick(myProducts).brand);
        const purposeArr = genPurposes();
        // 数据来源:约 7% 由 AI 助手录入(AI 来源必须同时有 aiSummary 与人工 summary)
        const isAi = chance(0.07);
        const hasAiEnrich = isAi || chance(0.35);
        const visitDate = day(d, randInt(8, 17), pick([0, 15, 30, 45]));

        // 有效性评定:评定滞后 1-5 天,拜访太新则仍为 PENDING;目标约 60% VALID / 38% PENDING / 少量 INVALID
        const evalLag = randInt(1, 5);
        const canEvaluate = d + evalLag <= 0 && chance(0.8); // 约两成可评定拜访经理尚未反馈
        let validityStatus = "PENDING";
        let evaluatedAt: Date | null = null;
        let invalidReason: string | null = null;
        if (canEvaluate) {
          const r = rng();
          if (r < 0.055) {
            validityStatus = "INVALID";
            invalidReason = pick(invalidReasons);
          } else {
            validityStatus = "VALID";
          }
          evaluatedAt = day(d + evalLag, randInt(9, 18), pick([0, 15, 30, 45]));
        }

        // 签到:地点=医院名,约 3% 地点异常
        const locationMismatch = chance(0.03);
        const checkinLocation = locationMismatch ? pick(hcos.filter((h) => h.id !== hcp.hcoId)).name : hcos.find((h) => h.id === hcp.hcoId)!.name;
        if (locationMismatch && validityStatus === "INVALID") invalidReason = "签到地点不对";

        if (validityStatus === "VALID") validCount++;
        else if (validityStatus === "INVALID") invalidCount++;
        else pendingCount++;
        if (locationMismatch) mismatchCount++;

        const visit = await prisma.visit.create({
          data: {
            employeeId: mr.id,
            hcpId: hcp.id,
            hcoId: hcp.hcoId,
            visitDate,
            type,
            purpose: purposeArr[0], // 旧自由文本字段保留,取首个目的
            purposes: purposeArr.join(","),
            outcome: chance(0.85) ? pick(outcomes) : null,
            duration: type === "PHONE" ? randInt(5, 15) : randInt(15, 60),
            notes,
            summary: pick(summaryTemplates)
              .replaceAll("{n}", hcp.name + (chance(0.5) ? "主任" : "医生"))
              .replaceAll("{brand}", pick(visitProducts).brand),
            nextStep: chance(0.5) ? pick(nextSteps).replaceAll("{n}", hcp.name) : null,
            source: isAi ? "AI" : "MANUAL",
            receiverId: mr.bossId,
            validityStatus,
            evaluatedById: validityStatus === "PENDING" ? null : mr.bossId,
            evaluatedAt,
            invalidReason,
            aiSummary: hasAiEnrich
              ? `代表与${hcp.name}就${visitProducts.map((p) => p.brand).join("、")}进行了${type === "PHONE" ? "电话" : "面对面"}沟通,客户关注度较高,需按计划跟进。`
              : null,
            aiSentiment: hasAiEnrich ? pick(sentiments) : null,
            products: {
              create: visitProducts.map((p) => ({
                product: { connect: { id: p.id } },
                feedback: chance(0.7) ? pick(["认可度提升", "担心不良反应管理", "希望补充真实世界数据", "价格方面有顾虑", "愿意在合适患者试用"]) : null,
              })),
            },
            checkins: {
              create: [
                {
                  employeeId: mr.id,
                  checkinTime: new Date(visitDate.getTime() - randInt(0, 10) * 60 * 1000),
                  locationName: checkinLocation,
                  latitude: 31.3 + rng() * 1.0,
                  longitude: 120.5 + rng() * 1.0,
                  status: locationMismatch ? "LOCATION_MISMATCH" : "NORMAL",
                },
              ],
            },
          },
        });
        visitCount++;

        // 约 35% 的面对面拜访关联样品发放
        if (type === "FACE_TO_FACE" && chance(0.35)) {
          const p = pick(visitProducts);
          const lot = lots.find((l) => l.productId === p.id)!;
          await prisma.sampleTransaction.create({
            data: {
              lotId: lot.id,
              employeeId: mr.id,
              hcpId: hcp.id,
              visitId: visit.id,
              quantity: randInt(1, 3),
              type: "DISTRIBUTE",
              transDate: visit.visitDate,
            },
          });
        }
      }
    }
  }

  // 将三名肿瘤线代表塑造成“高达成 / 进行中 / 明显落后”三种月度覆盖演示状态。
  // 原始拜访仍保留，仅用 DRAFT/SUBMITTED 表达是否已正式提交并计入覆盖。
  async function shapeCycleAchievement(mrId: string, desiredRate: number) {
    const plan = await prisma.cyclePlan.findFirst({
      where: { employeeId: mrId, month: cycleMonth },
      include: { items: true },
    });
    if (!plan) return;
    const hcpIds = plan.items.map((item) => item.hcpId);
    await prisma.visit.updateMany({
      where: { employeeId: mrId, hcpId: { in: hcpIds } },
      data: { status: "DRAFT" },
    });
    let remaining = Math.round(plan.items.reduce((sum, item) => sum + item.targetVisits, 0) * desiredRate);
    for (const item of plan.items) {
      if (remaining <= 0) break;
      const visits = await prisma.visit.findMany({
        where: { employeeId: mrId, hcpId: item.hcpId },
        select: { id: true },
        orderBy: { visitDate: "desc" },
        take: Math.min(item.targetVisits, remaining),
      });
      if (visits.length) {
        await prisma.visit.updateMany({ where: { id: { in: visits.map((visit) => visit.id) } }, data: { status: "SUBMITTED" } });
        remaining -= visits.length;
      }
    }
  }
  await shapeCycleAchievement(mrs[1].id, 0.55);
  await shapeCycleAchievement(mrs[2].id, 0);

  // ---------- 本周 TourPlan(weekStart = 2026-07-20) ----------
  console.log("创建周拜访计划...");
  const weekStart = new Date("2026-07-20T00:00:00+08:00");
  const planStatuses = ["APPROVED", "APPROVED", "SUBMITTED", "SUBMITTED", "DRAFT", "DRAFT"];
  for (let i = 0; i < mrs.length; i++) {
    const mr = mrs[i];
    const status = planStatuses[i];
    const myHcps = hcps.filter((h) => h.division === mr.division);
    const itemCount = randInt(4, 6);
    const items = Array.from({ length: itemCount }, (_, k) => {
      const planDate = new Date(weekStart);
      planDate.setDate(planDate.getDate() + (k % 5));
      planDate.setHours(9, 0, 0, 0);
      if (chance(0.8)) {
        const hcp = pick(myHcps);
        return { planDate, hcp: { connect: { id: hcp.id } }, note: pick(["重点客户拜访", "常规随访", "送文献资料", "样品补充"]) };
      }
      return { planDate, hcoName: "华东医药股份有限公司", note: "商业公司对接发货与库存" };
    });
    await prisma.tourPlan.create({
      data: {
        employeeId: mr.id,
        weekStart,
        status,
        approverId: status === "APPROVED" || status === "REJECTED" ? (mr.division === "肿瘤线" ? asmOnc.id : asmCvd.id) : null,
        approvedAt: status === "APPROVED" ? day(-3, 14) : null,
        items: { create: items },
      },
    });
  }

  // 将一条已批准计划与真实拜访关联，形成“部分完成”的周日历
  const approvedPlan = await prisma.tourPlan.findFirst({
    where: { employeeId: mrs[0].id, status: "APPROVED" },
    include: { items: { where: { hcpId: { not: null } }, take: 1 } },
  });
  if (approvedPlan?.items[0]) {
    const completedVisit = await prisma.visit.findFirst({
      where: { employeeId: mrs[0].id, hcpId: approvedPlan.items[0].hcpId },
      orderBy: { visitDate: "desc" },
    });
    if (completedVisit) {
      await prisma.tourPlanItem.update({
        where: { id: approvedPlan.items[0].id },
        data: { status: "COMPLETED", visitId: completedVisit.id },
      });
    }
  }

  // ---------- 2 个会议 ----------
  console.log("创建医学会议...");
  const deptMeeting = await prisma.medEvent.create({
    data: {
      name: "苏州大学附属第一医院肿瘤内科科室会",
      type: "科室会",
      eventDate: day(-9, 15), // 2026-07-15 已举办
      location: "苏州大学附属第一医院 内科楼3楼会议室",
      budget: 3000,
      status: "COMPLETED",
    },
  });
  const cityMeeting = await prisma.medEvent.create({
    data: {
      name: "华东肺癌靶向治疗城市会",
      type: "城市会",
      eventDate: day(15, 9), // 2026-08-08 计划中
      location: "杭州黄龙饭店",
      budget: 80000,
      status: "OPEN",
    },
  });
  const deptAttendees = hcps.filter((h) => h.division === "肿瘤线").slice(0, 6);
  for (const h of deptAttendees) {
    await prisma.eventAttendance.create({
      data: { eventId: deptMeeting.id, hcpId: h.id, status: "CHECKED_IN", checkedInAt: day(-9, 15, 5) },
    });
  }
  const cityAttendees = hcps.filter((h) => h.tier === "A").slice(0, 5);
  for (const h of cityAttendees) {
    await prisma.eventAttendance.create({ data: { eventId: cityMeeting.id, hcpId: h.id } });
  }

  // ---------- P0 闭环演示场景 ----------
  console.log("创建任务、辅导与样品闭环场景...");
  const demoMr = mrs[0];
  const demoHcp = hcps.find((hcp) => hcp.division === demoMr.division)!;
  const demoVisit = await prisma.visit.findFirst({
    where: { employeeId: demoMr.id, hcpId: demoHcp.id },
    orderBy: { visitDate: "desc" },
  });
  await prisma.followUpTask.createMany({
    data: [
      {
        title: "补充最新 III 期研究文献",
        description: "上次拜访承诺发送完整研究资料并确认反馈",
        status: "OPEN",
        priority: "HIGH",
        dueDate: day(-2, 18),
        assigneeId: demoMr.id,
        hcpId: demoHcp.id,
        hcoId: demoHcp.hcoId,
        sourceVisitId: demoVisit?.id,
      },
      {
        title: "确认下周科室会时间",
        status: "OPEN",
        priority: "NORMAL",
        dueDate: day(3, 18),
        assigneeId: demoMr.id,
        hcpId: demoHcp.id,
        hcoId: demoHcp.hcoId,
        sourceEventId: deptMeeting.id,
      },
      {
        title: "发送患者教育材料",
        status: "DONE",
        priority: "NORMAL",
        dueDate: day(-4, 18),
        completedAt: day(-3, 16),
        assigneeId: demoMr.id,
        hcpId: demoHcp.id,
        hcoId: demoHcp.hcoId,
        sourceVisitId: demoVisit?.id,
      },
    ],
  });
  await prisma.coachingAction.createMany({
    data: [
      {
        title: "提升拜访结果记录质量",
        description: "下次拜访需明确客户异议、达成结果和截止日期",
        status: "OPEN",
        managerId: asmOnc.id,
        employeeId: demoMr.id,
        sourceVisitId: demoVisit?.id,
        dueDate: day(4, 18),
      },
      {
        title: "完成重点客户拜访复盘",
        status: "DONE",
        managerId: asmOnc.id,
        employeeId: demoMr.id,
        sourceVisitId: demoVisit?.id,
        completedAt: day(-1, 17),
      },
    ],
  });

  // ---------- 产品批准资料与历史拜访使用 ----------
  console.log("创建产品批准资料...");
  const materialRecords = [];
  for (let index = 0; index < 3; index++) {
    const product = products[index];
    const approved = await prisma.productMaterial.create({
      data: {
        productId: product.id,
        title: `${product.brand} 核心研究沟通卡`,
        type: "DETAIL_AID",
        messageSummary: "仅按批准适应症沟通核心研究结果与安全性信息",
        externalUrl: `https://example.test/materials/${index + 1}/current.pdf`,
        version: "V2.0",
        approvalCode: `APP-2026-${String(index + 1).padStart(3, "0")}`,
        effectiveDate: new Date("2026-06-01T00:00:00+08:00"),
        expiryDate: index === 1 ? new Date("2026-08-10T00:00:00+08:00") : new Date("2027-01-01T00:00:00+08:00"),
        status: "APPROVED",
      },
    });
    await prisma.productMaterial.create({
      data: {
        productId: product.id,
        title: `${product.brand} 历史产品幻灯`,
        type: "SLIDE_DECK",
        messageSummary: "历史版本，仅用于展示追溯",
        externalUrl: `https://example.test/materials/${index + 1}/retired.pdf`,
        version: "V1.0",
        approvalCode: `APP-2025-${String(index + 1).padStart(3, "0")}`,
        effectiveDate: new Date("2025-06-01T00:00:00+08:00"),
        expiryDate: new Date("2026-06-01T00:00:00+08:00"),
        status: "RETIRED",
      },
    });
    materialRecords.push(approved);
  }
  const materialVisit = await prisma.visit.findFirst({ where: { status: "SUBMITTED", products: { some: { productId: products[0].id } } }, orderBy: { visitDate: "desc" } });
  if (materialVisit) {
    const material = materialRecords[0];
    await prisma.visitMaterialUsage.create({
      data: { visitId: materialVisit.id, materialId: material.id, titleSnapshot: material.title, versionSnapshot: material.version, approvalCodeSnapshot: material.approvalCode! },
    });
  }
  const demoLot = lots.find((lot) => lot.productId === products.find((product) => product.division === demoMr.division)!.id)!;
  await prisma.sampleTransaction.createMany({
    data: [
      {
        lotId: demoLot.id,
        employeeId: demoMr.id,
        quantity: 2,
        type: "RETURN",
        reason: "近期无发放计划，退回办事处",
        transDate: day(-1, 10),
      },
      {
        lotId: demoLot.id,
        employeeId: demoMr.id,
        quantity: -1,
        type: "ADJUST",
        reason: "月末盘点差异",
        transDate: day(0, 16),
      },
    ],
  });

  // ---------- Account Plan Lite:健康推进 / 决策关系风险 / 执行逾期 ----------
  console.log("创建战略客户 Account Plan...");
  const accountScenarios = [
    {
      hco: hcos[0],
      owner: mrs[0],
      goal: "完成核心产品院内准入并建立重点科室常规使用",
      situation: "重点科室认可度较高，药事路径明确",
      strategy: "以重点科室临床证据沟通带动药事路径推进",
      success: "完成准入并覆盖三个重点科室",
      milestoneStates: ["DONE", "DONE"],
      dueDates: [day(-8), day(-2)],
    },
    {
      hco: hcos[1],
      owner: mrs[1],
      goal: "建立关键决策共识并明确下一轮院内准入窗口",
      situation: "使用科室支持，但核心决策人仍保持中立",
      strategy: "补充药物经济学证据并安排跨科室沟通",
      success: "核心决策人转为支持并确认药事会窗口",
      milestoneStates: ["OPEN", "DONE"],
      dueDates: [day(12), day(-3)],
    },
    {
      hco: hcos[2],
      owner: mrs[2],
      goal: "推进重点科室试用并形成首批病例反馈",
      situation: "临床兴趣明确，但执行材料准备落后",
      strategy: "由 KA 协同代表完成病例筛选和科室会",
      success: "完成科室会并收集三例规范反馈",
      milestoneStates: ["OPEN", "OPEN"],
      dueDates: [day(-10), day(8)],
    },
  ];
  for (let index = 0; index < accountScenarios.length; index++) {
    const scenario = accountScenarios[index];
    const hospitalHcps = hcps.filter((hcp) => hcp.hcoId === scenario.hco.id).slice(0, 2);
    const plan = await prisma.accountPlan.create({
      data: {
        hcoId: scenario.hco.id,
        year: 2026,
        ownerId: scenario.owner.id,
        createdById: scenario.owner.bossId,
        businessGoal: scenario.goal,
        situation: scenario.situation,
        strategy: scenario.strategy,
        successCriteria: scenario.success,
        products: { create: [{ productId: products.find((product) => product.division === scenario.owner.division)!.id }] },
        stakeholders: {
          create: hospitalHcps.map((hcp, stakeholderIndex) => ({
            hcpId: hcp.id,
            decisionRole: stakeholderIndex === 0 ? "DECISION_MAKER" : "INFLUENCER",
            attitude: index === 1 && stakeholderIndex === 0 ? "NEUTRAL" : "SUPPORTIVE",
            notes: stakeholderIndex === 0 ? "年度计划核心关系人" : "重点科室影响者",
          })),
        },
        milestones: {
          create: [
            {
              title: index === 0 ? "完成准入材料评审" : index === 1 ? "完成决策人药经沟通" : "完成病例筛选材料",
              ownerId: scenario.owner.id,
              dueDate: scenario.dueDates[0],
              status: scenario.milestoneStates[0],
              completedAt: scenario.milestoneStates[0] === "DONE" ? scenario.dueDates[0] : null,
            },
            {
              title: index === 0 ? "确认首批使用科室" : index === 1 ? "完成重点科室访谈" : "举办重点科室会",
              ownerId: scenario.owner.id,
              dueDate: scenario.dueDates[1],
              status: scenario.milestoneStates[1],
              completedAt: scenario.milestoneStates[1] === "DONE" ? scenario.dueDates[1] : null,
            },
          ],
        },
      },
      include: { milestones: true },
    });
    if (index === 0) {
      const milestone = plan.milestones[0];
      const task = await prisma.followUpTask.create({
        data: {
          title: milestone.title,
          description: `来源：${scenario.hco.name} Account Plan`,
          status: "DONE",
          priority: "HIGH",
          assigneeId: scenario.owner.id,
          hcoId: scenario.hco.id,
          dueDate: milestone.dueDate,
          completedAt: milestone.completedAt,
        },
      });
      await prisma.accountMilestone.update({ where: { id: milestone.id }, data: { followUpTaskId: task.id } });
    }
    if (index === 1 && hospitalHcps[0]) {
      await prisma.visit.updateMany({
        where: { employeeId: scenario.owner.id, hcpId: hospitalHcps[0].id },
        data: { status: "DRAFT" },
      });
    }
  }

  // ---------- 本月(2026-07)每个 MR 的 Target ----------
  console.log("创建销售指标...");
  for (const mr of mrs) {
    const myProducts = products.filter((p) => p.division === mr.division);
    for (const p of myProducts) {
      await prisma.target.create({
        data: {
          employeeId: mr.id,
          productId: p.id,
          period: "2026-07",
          visitTarget: 40,
          salesTarget: Math.round(p.price * randInt(80, 200)),
        },
      });
    }
  }

  // ---------- 销售情报与共享知识 ----------
  console.log("创建销售情报...");
  const officialSource = await prisma.intelligenceSource.create({
    data: {
      name: "国家医保局",
      baseUrl: "https://www.nhsa.gov.cn/",
      sourceType: "OFFICIAL",
      collectionType: "LIST_PAGE",
      trustLevel: "AUTHORITATIVE",
      topicTypes: "POLICY",
      configJson: JSON.stringify({ demo: true }),
      lastCollectedAt: REF_NOW,
    },
  });
  const mediaSource = await prisma.intelligenceSource.create({
    data: {
      name: "医药行业媒体演示源",
      baseUrl: "https://example.com/pharma-news",
      sourceType: "MEDIA",
      collectionType: "RSS",
      trustLevel: "REFERENCE",
      topicTypes: "INDUSTRY_NEWS,COMPETITOR",
      configJson: JSON.stringify({ demo: true }),
      lastCollectedAt: REF_NOW,
    },
  });
  const focusProduct = products[0];
  const competitor = await prisma.competitorProduct.create({
    data: {
      name: "竞品A",
      molecule: "对照分子A",
      company: "示例药企",
      therapeuticCategory: focusProduct.therapeuticCategory,
      indications: "与重点产品相关的公开适应症演示信息",
      websiteUrl: "https://example.com/competitor-a",
    },
  });
  const intelligenceScenarios = [
    {
      type: "POLICY",
      title: `${focusProduct.therapeuticCategory}医保支付政策更新`,
      summary: "官方政策演示摘要，用于说明销售如何在拜访前理解准入环境变化。",
      source: officialSource,
      path: "demo-policy",
      verificationStatus: "VERIFIED",
      confidence: "HIGH",
      priority: "HIGH",
    },
    {
      type: "COMPETITOR",
      title: `${competitor.name}公开适应症动态`,
      summary: "竞品公开动态演示摘要，核验前只能作为内部线索。",
      source: mediaSource,
      path: "demo-competitor",
      verificationStatus: "PENDING_REVIEW",
      confidence: "MEDIUM",
      priority: "NORMAL",
    },
    {
      type: "INDUSTRY_NEWS",
      title: `${focusProduct.therapeuticCategory}市场关注度变化`,
      summary: "行业媒体演示信息，始终保留原始来源并等待人工核验。",
      source: mediaSource,
      path: "demo-market-news",
      verificationStatus: "PENDING_REVIEW",
      confidence: "LOW",
      priority: "NORMAL",
    },
    {
      type: "DISEASE_KNOWLEDGE",
      title: `${focusProduct.therapeuticCategory}患者分层基础知识`,
      summary: "供同一 SKU 团队共享的疾病知识要点，不作为诊疗建议。",
      source: officialSource,
      path: "demo-disease-knowledge",
      verificationStatus: "VERIFIED",
      confidence: "HIGH",
      priority: "NORMAL",
    },
    {
      type: "PRODUCT_KNOWLEDGE",
      title: `${focusProduct.brand}产品知识卡`,
      summary: "目标患者、核心证据和常见问题的内部准备摘要，批准材料另行展示。",
      source: officialSource,
      path: "demo-product-knowledge",
      verificationStatus: "VERIFIED",
      confidence: "HIGH",
      priority: "NORMAL",
    },
  ];
  for (const [index, item] of intelligenceScenarios.entries()) {
    const sourceUrl = new URL(item.path, item.source.baseUrl).toString();
    await prisma.salesIntelligence.create({
      data: {
        type: item.type,
        title: item.title,
        summary: item.summary,
        contentExcerpt: item.summary,
        sourceId: item.source.id,
        sourceName: item.source.name,
        sourceUrl,
        canonicalUrl: sourceUrl,
        publishedAt: day(-index - 1),
        collectedAt: REF_NOW,
        verificationStatus: item.verificationStatus,
        confidence: item.confidence,
        priority: item.priority,
        contentHash: `demo-intelligence-${index}`,
        products: { create: { productId: focusProduct.id } },
        therapeuticAreas: { create: { name: focusProduct.therapeuticCategory } },
        competitors: item.type === "COMPETITOR" ? { create: { competitorId: competitor.id } } : undefined,
      },
    });
  }

  console.log("✅ 种子数据完成:");
  console.log(`  员工 ${await prisma.employee.count()},部门 ${await prisma.department.count()},辖区 ${await prisma.territory.count()},机构 ${await prisma.hco.count()}`);
  console.log(`  HCP ${await prisma.hcp.count()},产品 ${await prisma.product.count()},批准资料 ${await prisma.productMaterial.count()},批次 ${await prisma.sampleLot.count()}`);
  console.log(`  拜访 ${visitCount}(有效 ${validCount} / 无效 ${invalidCount} / 待评定 ${pendingCount}),签到 ${await prisma.checkIn.count()}(地点异常 ${mismatchCount})`);
  console.log(`  样品事务 ${await prisma.sampleTransaction.count()},周计划 ${await prisma.tourPlan.count()},月度计划 ${await prisma.cyclePlan.count()},客户策略 ${await prisma.accountPlan.count()},销售结果 ${await prisma.salesResult.count()},会议 ${await prisma.medEvent.count()},指标 ${await prisma.target.count()}`);
  console.log(`  销售情报 ${await prisma.salesIntelligence.count()},情报来源 ${await prisma.intelligenceSource.count()},竞品 ${await prisma.competitorProduct.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
