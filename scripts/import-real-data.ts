/**
 * 外部 CRM 导出数据导入脚本
 * 数据源由 CSV_PATH 指定;默认读取项目目录外的拜访明细 CSV
 * 运行:npm run import:real
 *
 * 行为:
 *  1. 清空业务表(保留 Territory 辖区树,供分析接口继续使用)。若检测到 seed 演示数据
 *     (工号 YG 开头的员工)会打印提示;重复运行时也会清掉上次导入的数据,脚本幂等。
 *  2. 按 CSV 重建:五级部门树 / 员工(填写人=MR、接收人=ASM、协访人=MR)/ 医院 HCO /
 *     医生 HCP / 产品 / 拜访 Visit(+VisitProduct+CheckIn)。
 *  3. 批量 createMany(每批 2000),全程打印进度与最终计数。
 *
 * 数据清洗决策(见任务报告"偏离规范之处"):
 *  - 医院编码形如 "105038.0",统一剥掉尾部 ".0"。
 *  - 拜访客户名称可能带 "数字编码-" 前缀,剥前缀作为医生姓名;
 *    按(剥前缀后的姓名+医院名+科室名)去重。
 *  - 接收人工号/协访人工号存在逗号分隔多值,取第一个工号。
 *  - 四级部门空时归入占位部门"未分区",五级部门空时归入"未设办事处"。
 *  - 医院编码与名称均空时不建 HCO,visit.hcoId / checkin.locationName 置空。
 *  - 拜访目的存在系统枚举之外的值(项目洽谈/适应症等),按要求存原值。
 */
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = process.env.CSV_PATH
  ? path.resolve(process.env.CSV_PATH)
  : path.resolve(__dirname, "../../拜访客户明细-明细.csv");

const BATCH = 2000;
const uuid = () => crypto.randomUUID();

/** CSV 行类型(30 列) */
type Row = {
  一级部门: string; 二级部门: string; 三级部门: string; 四级部门: string; 五级部门: string;
  拜访id: string; 填写人工号: string; 填写人姓名: string; 拜访类型: string;
  拜访客户编码: string; 拜访客户名称: string; 所在医院编码: string; 所在医院名称: string; 所在科室名称: string;
  推广产品: string; 拜访目的: string; 拜访总结: string; ai摘要: string; 绑定签到数量: string;
  接收人工号: string; 接收人姓名: string; 协访人工号: string; 协访人姓名: string;
  拜访时间: string; 创建时间: string; 拜访是否有效评定: string; 评定人: string; 无效原因: string;
  评定时间: string; 数据来源: string;
};

const trim = (s: string | undefined | null) => (s ?? "").trim();
/** "2026-06-06 14:59:57" → Date(+08:00);空 → null */
function parseCnDate(s: string): Date | null {
  const t = trim(s);
  if (!t) return null;
  const d = new Date(t.replace(" ", "T") + "+08:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
/** 医院编码:"105038.0" → "105038" */
const normHcoCode = (s: string) => trim(s).replace(/\.0$/, "");
/** 医生姓名:剥掉 "数字编码-" 前缀 */
const normHcpName = (s: string) => trim(s).replace(/^\d+-/, "");
/** 逗号分隔多工号取第一个 */
const firstCode = (s: string) => trim(s).split(",")[0]?.trim() ?? "";
/** 稳定哈希 → tier,A:B:C ≈ 2:5:3 */
function tierOf(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const b = h % 10;
  return b < 2 ? "A" : b < 7 ? "B" : "C";
}

async function wipeExisting() {
  console.log("—— 第 0 步:清除已有业务数据(保留 Territory 辖区树)——");
  const ygCount = await prisma.employee.count({ where: { employeeCode: { startsWith: "YG" } } });
  if (ygCount > 0) console.log(`检测到 seed 演示数据(YG 工号员工 ${ygCount} 人),一并清除。`);
  // 按依赖顺序删除
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["CheckIn", () => prisma.checkIn.deleteMany()],
    ["EventAttendance", () => prisma.eventAttendance.deleteMany()],
    ["MedEvent", () => prisma.medEvent.deleteMany()],
    ["SampleTransaction", () => prisma.sampleTransaction.deleteMany()],
    ["SampleLot", () => prisma.sampleLot.deleteMany()],
    ["VisitProduct", () => prisma.visitProduct.deleteMany()],
    ["Visit", () => prisma.visit.deleteMany()],
    ["TourPlanItem", () => prisma.tourPlanItem.deleteMany()],
    ["TourPlan", () => prisma.tourPlan.deleteMany()],
    ["Target", () => prisma.target.deleteMany()],
    ["Hcp", () => prisma.hcp.deleteMany()],
    ["Hco", () => prisma.hco.deleteMany()],
    ["Product", () => prisma.product.deleteMany()],
    ["Employee", () => prisma.employee.deleteMany()],
    ["Department", () => prisma.department.deleteMany()],
  ];
  for (const [name, fn] of steps) {
    const { count } = await fn();
    if (count > 0) console.log(`  删除 ${name}: ${count}`);
  }
  console.log("清除完成(Territory 保留 " + (await prisma.territory.count()) + " 条)。");
}

async function main() {
  console.log(`读取 CSV:${CSV_PATH}`);
  const rows = parse(fs.readFileSync(CSV_PATH), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
  console.log(`解析完成:${rows.length} 行`);

  await wipeExisting();

  // ---------- 1. 五级部门树 ----------
  console.log("—— 第 1 步:部门树 ——");
  const L4_PLACEHOLDER = "未分区";
  const L5_PLACEHOLDER = "未设办事处";
  const deptIdByPath = new Map<string, string>();
  const getDept = async (names: string[]): Promise<string> => {
    let parentId: string | null = null;
    let key = "";
    for (let i = 0; i < names.length; i++) {
      key = key ? `${key}/${names[i]}` : names[i];
      let id: string | undefined = deptIdByPath.get(key);
      if (!id) {
        const rec: { id: string } = await prisma.department.create({ data: { name: names[i], level: i + 1, parentId } });
        id = rec.id;
        deptIdByPath.set(key, id);
      }
      parentId = id;
    }
    return parentId!;
  };
  // 每行的办事处(level 5)id
  const officeIdOfRow = new Map<number, string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const l1 = trim(r.一级部门) || "综合创新产品事业部";
    const l2 = trim(r.二级部门) || "未设战区";
    const l3 = trim(r.三级部门) || "未设分管区";
    const l4 = trim(r.四级部门) || L4_PLACEHOLDER;
    const l5 = trim(r.五级部门) || L5_PLACEHOLDER;
    officeIdOfRow.set(i, await getDept([l1, l2, l3, l4, l5]));
  }
  console.log(`部门节点 ${deptIdByPath.size} 个(含占位)`);

  // ---------- 2. 员工 ----------
  console.log("—— 第 2 步:员工(填写人/接收人/协访人)——");
  const empIdByCode = new Map<string, string>();
  const empNameByCode = new Map<string, string>();
  const empOfficeByCode = new Map<string, string>(); // code → level5 deptId
  const roleByCode = new Map<string, string>();
  const receiverSet = new Set<string>();

  // 第一遍:收集工号→姓名/办事处,接收人/协访人工号集合
  const jointOnly: { code: string; name: string; officeId: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fc = trim(r.填写人工号);
    if (fc && !empNameByCode.has(fc)) {
      empNameByCode.set(fc, trim(r.填写人姓名));
      empOfficeByCode.set(fc, officeIdOfRow.get(i)!);
    }
    const rc = firstCode(r.接收人工号);
    if (rc) {
      receiverSet.add(rc);
      if (!empNameByCode.has(rc)) {
        empNameByCode.set(rc, trim(r.接收人姓名).split(",")[0]?.trim() ?? rc);
      }
    }
    const jc = firstCode(r.协访人工号);
    if (jc && !empNameByCode.has(jc)) {
      empNameByCode.set(jc, trim(r.协访人姓名).split(",")[0]?.trim() ?? jc);
      jointOnly.push({ code: jc, name: empNameByCode.get(jc)!, officeId: officeIdOfRow.get(i)! });
    }
  }
  // 创建:先全部按基础信息建 MR,再把接收人升级 ASM;协访人若在工号集合外,按首次出现的办事处挂靠
  for (const [code, name] of empNameByCode) {
    const isReceiver = receiverSet.has(code);
    const officeId = empOfficeByCode.get(code) ?? jointOnly.find((j) => j.code === code)?.officeId ?? null;
    const rec = await prisma.employee.create({
      data: {
        employeeCode: code,
        name: name || code,
        role: isReceiver ? "ASM" : "MR",
        division: "综合创新产品事业部",
        departmentId: officeId,
      },
    });
    empIdByCode.set(code, rec.id);
    roleByCode.set(code, isReceiver ? "ASM" : "MR");
  }
  console.log(`员工 ${empIdByCode.size} 人(其中接收人/ASM ${receiverSet.size} 人)`);

  // 汇报关系:每个办事处内出现次数最多的接收人 → 该办事处所有 MR 的 reportsTo
  const officeReceiverCount = new Map<string, Map<string, number>>(); // officeId → receiverCode → count
  for (let i = 0; i < rows.length; i++) {
    const rc = firstCode(rows[i].接收人工号);
    if (!rc) continue;
    const officeId = officeIdOfRow.get(i)!;
    let m = officeReceiverCount.get(officeId);
    if (!m) officeReceiverCount.set(officeId, (m = new Map()));
    m.set(rc, (m.get(rc) ?? 0) + 1);
  }
  const bossByOffice = new Map<string, string>();
  for (const [officeId, m] of officeReceiverCount) {
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) bossByOffice.set(officeId, top[0]);
  }
  let reportsToSet = 0;
  for (const [code, empId] of empIdByCode) {
    if (roleByCode.get(code) !== "MR") continue;
    const officeId = empOfficeByCode.get(code) ?? jointOnly.find((j) => j.code === code)?.officeId;
    const bossCode = officeId ? bossByOffice.get(officeId) : undefined;
    const bossId = bossCode ? empIdByCode.get(bossCode) : undefined;
    if (bossId && bossId !== empId) {
      await prisma.employee.update({ where: { id: empId }, data: { reportsToId: bossId } });
      reportsToSet++;
    }
  }
  console.log(`汇报关系:为 ${reportsToSet} 名 MR 设置 reportsTo`);

  // 评定人姓名 → 员工(重名时优先 ASM)
  const empIdByName = new Map<string, string>();
  {
    const all = await prisma.employee.findMany({ select: { id: true, name: true, role: true } });
    for (const e of all) {
      const cur = empIdByName.get(e.name);
      if (!cur || e.role === "ASM") empIdByName.set(e.name, e.id);
    }
  }

  // ---------- 3. HCO ----------
  console.log("—— 第 3 步:医疗机构 ——");
  const hcoIdByKey = new Map<string, string>(); // code 或 "name:xxx"
  for (const r of rows) {
    const code = normHcoCode(r.所在医院编码);
    const name = trim(r.所在医院名称);
    if (!code && !name) continue; // 编码名称均空:不建机构
    const key = code || `name:${name}`;
    if (!hcoIdByKey.has(key)) {
      const rec = await prisma.hco.create({ data: { code: code || null, name: name || code, type: "HOSPITAL" } });
      hcoIdByKey.set(key, rec.id);
    }
  }
  console.log(`医疗机构 ${hcoIdByKey.size} 家`);

  // ---------- 4. HCP ----------
  console.log("—— 第 4 步:医生 HCP ——");
  const hcpIdByKey = new Map<string, string>();
  let hcpSeq = 10001;
  const hcpBatch: object[] = [];
  for (const r of rows) {
    const name = normHcpName(r.拜访客户名称);
    if (!name) continue;
    const hospName = trim(r.所在医院名称);
    const dept = trim(r.所在科室名称);
    const key = `${name}|${hospName}|${dept}`;
    if (hcpIdByKey.has(key)) continue;
    const hcoCode = normHcoCode(r.所在医院编码);
    const hcoId = hcoCode || hospName ? hcoIdByKey.get(hcoCode || `name:${hospName}`) ?? null : null;
    const id = uuid();
    hcpIdByKey.set(key, id);
    hcpBatch.push({ id, code: `DR${hcpSeq++}`, name, specialty: dept || null, tier: tierOf(key), hcoId });
    if (hcpBatch.length >= BATCH) {
      await prisma.hcp.createMany({ data: hcpBatch as never });
      hcpBatch.length = 0;
      console.log(`  HCP 进度:${hcpIdByKey.size}`);
    }
  }
  if (hcpBatch.length) await prisma.hcp.createMany({ data: hcpBatch as never });
  console.log(`医生 ${hcpIdByKey.size} 位(编码 DR10001 起)`);

  // ---------- 5. 产品 ----------
  console.log("—— 第 5 步:产品 ——");
  const productIdByBrand = new Map<string, string>();
  for (const r of rows) {
    for (const b of trim(r.推广产品).split(",")) {
      const brand = b.trim();
      if (brand && !productIdByBrand.has(brand)) {
        const rec = await prisma.product.create({
          data: { brand, molecule: brand, therapeuticCategory: "综合创新", division: "综合创新产品事业部" },
        });
        productIdByBrand.set(brand, rec.id);
      }
    }
  }
  console.log(`产品 ${productIdByBrand.size} 个`);

  // ---------- 6. 拜访 + 产品明细 + 签到 ----------
  console.log("—— 第 6 步:拜访 / 产品明细 / 签到(批量插入)——");
  const VALIDITY: Record<string, string> = { 有效拜访: "VALID", 未反馈: "PENDING", 无效拜访: "INVALID" };
  const visitBatch: object[] = [];
  const vpBatch: object[] = [];
  const ciBatch: object[] = [];
  let visitCount = 0;
  let vpCount = 0;
  let ciCount = 0;
  let skipped = 0;
  let evaluatorMiss = 0;

  const flush = async () => {
    if (visitBatch.length) {
      await prisma.visit.createMany({ data: visitBatch as never });
      visitCount += visitBatch.length;
      visitBatch.length = 0;
    }
    if (vpBatch.length) {
      await prisma.visitProduct.createMany({ data: vpBatch as never });
      vpCount += vpBatch.length;
      vpBatch.length = 0;
    }
    if (ciBatch.length) {
      await prisma.checkIn.createMany({ data: ciBatch as never });
      ciCount += ciBatch.length;
      ciBatch.length = 0;
    }
    console.log(`  进度:拜访 ${visitCount} / 产品明细 ${vpCount} / 签到 ${ciCount}`);
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const employeeId = empIdByCode.get(trim(r.填写人工号));
    const visitDate = parseCnDate(r.拜访时间);
    if (!employeeId || !visitDate) {
      skipped++;
      continue;
    }
    const id = uuid();
    const hospName = trim(r.所在医院名称);
    const hcoCode = normHcoCode(r.所在医院编码);
    const hcoId = hcoCode || hospName ? hcoIdByKey.get(hcoCode || `name:${hospName}`) ?? null : null;
    const hcpKey = `${normHcpName(r.拜访客户名称)}|${hospName}|${trim(r.所在科室名称)}`;
    const hcpId = hcpIdByKey.get(hcpKey) ?? null;
    const receiverId = empIdByCode.get(firstCode(r.接收人工号)) ?? null;
    const jointWithId = empIdByCode.get(firstCode(r.协访人工号)) ?? null;
    const validityStatus = VALIDITY[trim(r.拜访是否有效评定)] ?? "PENDING";
    const evaluatorName = trim(r.评定人);
    let evaluatedById: string | null = null;
    if (evaluatorName) {
      evaluatedById = empIdByName.get(evaluatorName) ?? null;
      if (!evaluatedById) evaluatorMiss++;
    }
    const createdAt = parseCnDate(r.创建时间) ?? visitDate;
    const summary = trim(r.拜访总结) || null;
    const aiSummary = trim(r.ai摘要) || null;

    visitBatch.push({
      id,
      employeeId,
      hcpId,
      hcoId,
      visitDate,
      type: "FACE_TO_FACE",
      purpose: trim(r.拜访目的).split(",")[0]?.trim() || null,
      purposes: trim(r.拜访目的) || null,
      summary,
      notes: summary,
      aiSummary,
      source: trim(r.数据来源) === "AI" ? "AI" : "MANUAL",
      receiverId,
      jointWithId,
      validityStatus,
      evaluatedById,
      evaluatedAt: parseCnDate(r.评定时间),
      invalidReason: trim(r.无效原因) || null,
      createdAt,
      updatedAt: createdAt,
    });

    for (const b of trim(r.推广产品).split(",")) {
      const pid = productIdByBrand.get(b.trim());
      if (pid) vpBatch.push({ id: uuid(), visitId: id, productId: pid });
    }
    ciBatch.push({
      id: uuid(),
      visitId: id,
      employeeId,
      checkinTime: visitDate,
      locationName: hospName || null,
      status: "NORMAL",
    });

    if (visitBatch.length >= BATCH) await flush();
  }
  await flush();
  if (skipped) console.log(`  跳过 ${skipped} 行(缺填写人或拜访时间)`);
  if (evaluatorMiss) console.log(`  评定人未匹配到员工:${evaluatorMiss} 行(evaluatedById 置空)`);

  // ---------- 最终计数 ----------
  console.log("—— 导入完成,最终计数 ——");
  console.log(`  员工 Employee:      ${await prisma.employee.count()}`);
  console.log(`  部门 Department:    ${await prisma.department.count()}`);
  console.log(`  医院 Hco:           ${await prisma.hco.count()}`);
  console.log(`  医生 Hcp:           ${await prisma.hcp.count()}`);
  console.log(`  产品 Product:       ${await prisma.product.count()}`);
  console.log(`  拜访 Visit:         ${await prisma.visit.count()}`);
  console.log(`  产品明细 VisitProduct:${await prisma.visitProduct.count()}`);
  console.log(`  签到 CheckIn:       ${await prisma.checkIn.count()}`);
  const byValidity = await prisma.visit.groupBy({ by: ["validityStatus"], _count: true });
  console.log(`  有效性分布:         ${byValidity.map((v) => `${v.validityStatus}=${v._count}`).join(" / ")}`);
  const bySource = await prisma.visit.groupBy({ by: ["source"], _count: true });
  console.log(`  来源分布:           ${bySource.map((v) => `${v.source}=${v._count}`).join(" / ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
