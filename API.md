# Pharma CRM (SFA) — REST API 契约文档

> 第一阶段交付:数据模型 + 种子数据 + REST API。
> 第二阶段(对照外部 CRM 导出格式)新增:五级部门树 Department、员工工号 employeeCode、
> HCP/HCO 编码 code、结构化拜访目的 Visit.purposes、人工总结 Visit.summary、数据来源 Visit.source、
> 报告接收人 Visit.receiverId、有效性评定(validityStatus/evaluatedById/evaluatedAt/invalidReason)、签到 CheckIn,
> 以及 `POST /api/visits/:id/evaluate`、`POST /api/visits/:id/checkins`、`GET /api/evaluations/pending`、`GET /api/departments`。
> 第三阶段(对照正大天晴"客融CRM"系统截图反推)新增:HCP/HCO 全档案字段扩展、客户分级体系(A/B/C/D,null=未分级)
> 与分级历史 CustomerTierHistory、客户-代表多对多分配 CustomerAssignment、建档审批工作流 CustomerApplication、
> HCO 子档案(科室 HcoDepartment / 进院产品 HcoProduct / 国考成绩 HcoExamResult)、
> HCP 子档案(教育经历 HcpEducation / 银行账户 HcpBankAccount)、敏感字段全局脱敏(姓名/手机号/证件号/银行账号),
> 以及 `GET /api/customers/stats`、`POST/GET /api/hcp/:id/tier(-history)`、`POST/GET /api/hco/:id/tier(-history)`、
> `POST /api/assignments`、`DELETE /api/assignments/:id`、`/api/applications` 全流程(见 §11-§13)。
> 技术栈:Next.js 15(App Router,route handler)+ TypeScript + Prisma 6 + SQLite(`prisma/dev.db`)。
> 后续 UI 与 MCP server 开发请以本文档为准。字段名与 Prisma schema(`prisma/schema.prisma`)严格一致。

## 通用约定

- **Base URL**:`http://localhost:5618`(dev,`npm run dev`,端口固定 5618)
- **Content-Type**:所有 POST/PATCH 均为 `application/json`
- **列表返回**:`{ "data": [...], "total": number }`(除非另有说明)
- **详情/单对象返回**:直接返回对象(201 创建 / 200 成功)
- **错误返回**:`{ "error": string }`,状态码语义:
  - `400` 参数缺失/非法(如必填字段、非法枚举、非法日期)
  - `404` 资源不存在
  - `409` 业务状态冲突(如库存不足、计划状态不允许审批)
- **ID**:全部为 Prisma `cuid()` 字符串
- **日期**:ISO 8601 字符串。查询参数 `from`/`to` 为闭区间(`gte`/`lte`)
- **枚举**(以字符串存储):
  - Employee.role:`MR | ASM | RSM | ADMIN`(医药代表/地区经理/大区经理/管理员)
  - Territory.level:`ZONE | REGION | AREA`(大区/地区/办事处)
  - Department.level:`1 | 2 | 3 | 4 | 5`(事业部/战区/分管区/区/办事处,整数)
  - Hco.type:`HOSPITAL | PHARMACY | DISTRIBUTOR`
  - Hco.tier / Hcp.tier:`A | B | C | D`,`null` = 未分级
  - Hco.category:`目标医院 | 潜力医院 | 观察医院`;Hco.cooperationStatus:`合作 | 暂停 | 终止`
  - HcoProduct.status:`ENTERED`(已进院)| `POOL`(客户池)
  - CustomerAssignment.role:`OWNER`(负责)| `COLLAB`(协作)
  - CustomerApplication.type:`HCP_CREATE | HCO_CREATE | HCP_MODIFY | HCO_MODIFY`
  - CustomerApplication.status:`DRAFT`(暂存草稿)| `PENDING`(待审核)| `APPROVED` | `REJECTED`
  - CustomerApplication.pool:客户池(如 `架构客户池 | 业绩客户池`,可空)
  - Hcp.tier 历史值 `A | B | C` 兼容保留
  - Visit.type:`FACE_TO_FACE | PHONE | CONFERENCE | JOINT`(协同拜访)
  - Visit.purposes:逗号分隔多选,单项枚举 `产品信息传递 | 临床信息沟通 | 市场现状调研 | 学术会议沟通 | 其他`
  - Visit.source:`MANUAL | AI | IMPORT`(手工录入 / AI 助手录入 / 导入,默认 MANUAL)
  - Visit.validityStatus:`PENDING | VALID | INVALID`(未反馈 / 有效 / 无效,默认 PENDING)
  - Visit.aiSentiment:`POSITIVE | NEUTRAL | NEGATIVE`
  - CheckIn.status:`NORMAL | LOCATION_MISMATCH`(正常 / 签到地点不对,默认 NORMAL)
  - TourPlan.status:`DRAFT | SUBMITTED | APPROVED | REJECTED`
  - SampleTransaction.type:`RECEIVE`(代表领用)| `DISTRIBUTE`(发放给医生)
- **敏感字段全局脱敏**:HCP 的 `name`(保留首尾字,如 `张*明`)、`phone`(前 3 后 2)、
  `idNumber`(前 3 后 2)、银行账户 `accountNo`(前 4 后 2)在 HCP 列表/详情及嵌套出现处一律脱敏输出;
  数据库存原文,仅 API 层脱敏。

## 演示数据基准

种子数据的时间基准为 **2026-07-24**(本周 = 2026-07-20 所在周,本月 = `2026-07`)。
分析类接口支持 `asOf=YYYY-MM-DD` 参数把"今天"钉在该日期,便于演示与测试;不传则使用服务器当前时间。

---

## 1. 员工与组织 Employees

### GET /api/employees
完整组织树(嵌套 `subordinates`),无参数。每个节点含工号 `employeeCode`(如 `YG1001`)、
所属部门 `department` 与部门全路径 `departmentPath`(五级行政组织,见 §10 部门树)。

```json
{
  "data": [
    {
      "id": "cm…", "employeeCode": "YG1001", "name": "王建国", "role": "RSM", "division": "肿瘤线",
      "phone": "13800000001", "reportsToId": null,
      "territory": { "id": "cm…", "name": "华东大区", "level": "ZONE" },
      "department": { "id": "cm…", "name": "南京一办事处", "level": 5 },
      "departmentPath": "综合创新产品事业部 / 中部战区A / 苏皖分管区A / 南京区A / 南京一办事处",
      "subordinates": [ { "id": "cm…", "employeeCode": "YG1002", "name": "李强", "role": "ASM", "subordinates": [ … ] } ]
    }
  ],
  "total": 9
}
```

### GET /api/employees/:id
员工详情:下属、辖区、上级、指定月份 target。
Query:`period=YYYY-MM`(可选,默认服务器当月;演示用 `2026-07`)。

```json
{
  "id": "cm…", "name": "刘洋", "role": "MR", "division": "肿瘤线", "phone": "13800000013",
  "territory": { "id": "cm…", "name": "苏州办事处", "level": "AREA", "parentId": "cm…" },
  "reportsTo": { "id": "cm…", "name": "李强", "role": "ASM" },
  "subordinates": [],
  "currentPeriod": "2026-07",
  "targets": [
    { "id": "cm…", "period": "2026-07", "visitTarget": 40, "salesTarget": 725400,
      "product": { "id": "cm…", "brand": "安瑞泽", "molecule": "奥希替尼" } }
  ]
}
```

---

## 2. 医生 HCP

### GET /api/hcp
搜索/过滤,结果含 `hco` 摘要与合作代表 `assignments`(代表姓名 + 所属办事处)。
每个 HCP 含客户编码 `code`(如 `DR0001`)。`name` / `phone` / `idNumber` 已脱敏。Query(均可组合):
- `query` — 模糊匹配医生姓名/科室/标签/所属机构名
- `tier` — `A|B|C|D`
- `graded` — `true`=已分级(tier 非空)/ `false`=未分级(tier 为 null)
- `mine` — `true`=我的客户(有分配关系),必须配合 `employeeId`
- `employeeId` — 配合 `mine=true`
- `hcoId` — 按机构过滤
- `specialty` — 科室模糊匹配(如 `肿瘤内科`)
- `page` / `pageSize` — 分页(默认 1 / 20,pageSize 上限 100)

```json
{
  "data": [
    { "id": "cm…", "code": "DR0001", "name": "张*远", "title": "主任医师", "specialty": "肿瘤内科",
      "tier": "A", "hcoId": "cm…", "phone": "139****01", "wechat": null,
      "tags": "KOL,肺癌领域", "notes": null,
      "doctorLevel": "主任医师", "adminDuty": "科主任", "isPharmacyCommittee": "是",
      "weeklyOutpatient": 60, "managedBeds": 30, "expertise": "肺癌、消化道肿瘤综合治疗",
      "hco": { "id": "cm…", "name": "苏州大学附属第一医院", "type": "HOSPITAL", "level": "三级甲等" },
      "assignments": [
        { "id": "cm…", "role": "OWNER",
          "employee": { "id": "cm…", "name": "刘洋", "role": "MR", "employeeCode": "YG1013",
                        "department": { "id": "cm…", "name": "苏州办事处", "level": 5 } } },
        { "id": "cm…", "role": "COLLAB", "employee": { "id": "cm…", "name": "王芳", "role": "MR", "employeeCode": "YG1014", "department": null } }
      ] }
  ],
  "total": 1, "page": 1, "pageSize": 20
}
```

### POST /api/hcp
新建医生。必填 `name`;`tier` 可空(null=未分级),允许 `A|B|C|D`。
支持全部扩展标量字段(见 schema)与嵌套子记录 `educations[]` / `bankAccounts[]`。

```json
// 请求
{ "name": "测试医生", "title": "主治医师", "specialty": "肿瘤内科", "tier": "B",
  "hcoId": "cm…", "phone": "139…", "gender": "男",
  "doctorLevel": "主治医师", "adminDuty": "科副主任", "isPharmacyCommittee": "否",
  "weeklyOutpatient": 45, "managedBeds": 20, "expertise": "肺癌靶向治疗",
  "educations": [ { "school": "南京医科大学", "major": "临床医学", "degree": "硕士",
                    "education": "研究生", "gradDate": "2018-07", "mentor": "王教授" } ],
  "bankAccounts": [ { "accountName": "测试医生", "bankName": "中国银行",
                      "accountNo": "6227000011112222333", "accountType": "借记卡", "isDefault": true } ] }
// 响应 201:创建后的 HCP 对象(含 hco 摘要 + educations + bankAccounts + assignments;敏感字段脱敏)
```

### GET /api/hcp/:id — HCP 360
医生全部档案字段(基础/工作/其他/证件)+ `educations`(教育经历)+ `bankAccounts`(银行账户,accountNo 脱敏)
+ `assignments`(合作代表)+ 所属医院(含辖区)+ 最近 50 条拜访历史(代表姓名、产品明细、样品)
+ 参会记录 + 收到的样品汇总 + 统计。`name` / `phone` / `idNumber` 脱敏。

```json
{
  "id": "cm…", "name": "张*远", "title": "主任医师", "specialty": "肿瘤内科", "tier": "A",
  "gender": "男", "doctorLevel": "主任医师", "adminDuty": "科主任", "isPharmacyCommittee": "是",
  "weeklyOutpatient": 60, "managedBeds": 30, "expertise": "肺癌、消化道肿瘤综合治疗",
  "idType": "身份证", "idNumber": "320***********01",
  "tags": "KOL,肺癌领域",
  "educations": [ { "id": "cm…", "school": "南京医科大学", "major": "临床医学", "degree": "硕士", "gradDate": "2010-07" } ],
  "bankAccounts": [ { "id": "cm…", "accountName": "张明远", "bankName": "招商银行", "accountNo": "6228****79", "isDefault": true } ],
  "assignments": [ { "id": "cm…", "role": "OWNER", "employee": { "id": "cm…", "name": "刘洋", "role": "MR", "department": { "name": "苏州办事处", "level": 5 } } } ],
  "hco": { "id": "cm…", "name": "苏州大学附属第一医院", "type": "HOSPITAL", "level": "三级甲等",
           "territory": { "id": "cm…", "name": "苏州办事处" } },
  "visits": [ …最近 50 条,结构同前… ],
  "eventAttendances": [ … ],
  "sampleSummary": [ { "product": { "id": "cm…", "brand": "泰瑞宁", "molecule": "阿美替尼" }, "totalQty": 1 } ],
  "stats": { "visitCount": 16, "eventCount": 2, "lastVisitDate": "2026-07-24T01:15:00.000Z" }
}
```

### PATCH /api/hcp/:id
更新标量字段(全部 HCP 标量,部分更新传谁改谁;tier 允许 `A|B|C|D|null`)。
传入 `educations[]` / `bankAccounts[]` 数组时**整体替换**对应子记录(先删后建);不传则不动。

### POST /api/hcp/:id/tier
调整医生分级,自动写 CustomerTierHistory:

```json
// 请求
{ "toTier": "A", "changedById": "cm…", "reason": "销量提升,升级重点客户" }
// 响应 200:更新后的 HCP 对象 + fromTier(原分级,null=原未分级)
```

校验:`toTier` 必须 `A|B|C|D`(400);`changedById` 必须存在(404);HCP 不存在 404。

### GET /api/hcp/:id/tier-history
分级变更历史,按 `changedAt` 倒序:`{ data: [{ id, fromTier, toTier, changedById, reason, changedAt }], total }`。

---

## 3. 医疗机构 HCO

### GET /api/hco
Query:`query`(名称/地址模糊)、`type`、`territoryId`、`graded`(true/false,按 tier 是否为空)、
`mine=true` + `employeeId`(该员工有分配关系的机构)。
返回含 `territory` 摘要、医院编码 `code`、`category`(客户分类)、`kaOwner`(KA 负责人)、
`latestExam`(最新国考成绩:年份+等级+分数+排名)、`assignments`(合作代表)与 `_count: { hcps, visits }`。

### POST /api/hco
必填 `name`;`type` 默认 `HOSPITAL`。支持全部扩展标量字段(基础/工商/机构/管理/合作,见 schema)
与嵌套 `departments[]`(科室)。`tier` 允许 `A|B|C|D`;`kaOwnerId` 校验员工存在。响应 201。

### GET /api/hco/:id — HCO 360
机构全部档案字段 + `departments`(科室)+ `hospitalProducts`(进院产品,含 `product` 明细,status=ENTERED/POOL)
+ `examResults`(国考成绩,按年份倒序)+ `assignments`(合作代表)+ `kaOwner`(KA 负责人)
+ `territory`(归属辖区)+ `hcps`(院内医生,姓名脱敏)+ `_count.visits`。

### POST /api/hco/:id/tier 与 GET /api/hco/:id/tier-history
同 HCP(见 §2),`toTier` / `changedById` / `reason` 校验规则一致。

---

## 4. 产品 Products

### GET /api/products
Query:`division`(事业部)、`query`(商品名/通用名/治疗领域模糊)。返回含 `sampleLots` 数组。

```json
{
  "data": [
    { "id": "cm…", "brand": "安瑞泽", "molecule": "奥希替尼",
      "therapeuticCategory": "肺癌靶向治疗", "division": "肿瘤线",
      "price": 5580, "unit": "80mg*30片/盒",
      "sampleLots": [ { "id": "cm…", "lotNumber": "LOT-安202635-1", "expiryDate": "2027-08-27T16:00:00.000Z", "totalQty": 1234 } ] }
  ],
  "total": 6
}
```

---

## 5. 拜访 Visits(DCR)

### GET /api/visits
Query(均可组合):`employeeId`、`hcpId`、`from`、`to`(ISO 日期/时间)、`type`、
`validityStatus`(PENDING|VALID|INVALID)、`source`(MANUAL|AI|IMPORT)。
返回按 `visitDate` 降序,每条含 `employee` / `receiver`(报告接收人)/ `evaluatedBy`(评定人)/ `hcp`(含 code)/
`hco`(含 code)/ `products[].product` / `samples[].lot.product` / `checkins[]`(签到),上限 500 条。
拜访对象同时带:`purposes`(逗号分隔结构化目的)、`summary`(人工总结)、`source`、
`validityStatus` / `evaluatedAt` / `invalidReason`(有效性评定)。

### POST /api/visits
新建拜访,支持嵌套产品明细、样品发放与签到。

```json
// 请求
{
  "employeeId": "cm…",                    // 必填,必须存在
  "hcpId": "cm…", "hcoId": "cm…",         // 可选,存在性校验
  "visitDate": "2026-07-24T10:30:00+08:00", // 可选,默认当前时间
  "type": "FACE_TO_FACE",                  // 可选,默认 FACE_TO_FACE
  "purposes": ["产品信息传递", "临床信息沟通"], // 可选,结构化目的多选(存为逗号分隔)
  "purpose": "产品信息传递",                 // 旧自由文本字段,向后兼容保留
  "outcome": "同意试用",
  "duration": 25, "notes": "主任对一线数据认可…",
  "summary": "本次拜访医生接受度较好,约定下周带文献回访", // 人工总结(与 aiSummary 并存)
  "nextStep": "下周带文献回访",
  "source": "MANUAL",                      // 可选,MANUAL | AI | IMPORT,默认 MANUAL
  "receiverId": "cm…",                     // 可选,报告接收人;默认 = 填写人的直属上级
  "aiSummary": "…", "aiSentiment": "POSITIVE",
  "products": [ { "productId": "cm…", "feedback": "愿意在合适患者试用" } ],
  "samples":  [ { "lotId": "cm…", "quantity": 2 } ],
  "checkins": [ { "checkinTime": "2026-07-24T10:25:00+08:00",   // 可选,默认当前时间
                  "locationName": "苏州大学附属第一医院",
                  "latitude": 31.30, "longitude": 120.62,       // 经纬度可选
                  "status": "NORMAL" } ]                        // 可选,默认 NORMAL
}
// 响应 201:完整 visit 对象(结构同 GET 列表项,含 checkins)
```

`purposes` 单项必须在枚举 `产品信息传递 | 临床信息沟通 | 市场现状调研 | 学术会议沟通 | 其他` 内,否则 400;
`checkins[]` 与拜访在同一事务中创建,`status` 仅允许 `NORMAL | LOCATION_MISMATCH`。

**样品业务规则**:
- 每条 `samples[]` 自动创建一条 `SampleTransaction`(type=`DISTRIBUTE`,关联该 visit 与 hcp)
- 校验该代表在**该批次所属产品**上的当前库存(累计 RECEIVE − 累计 DISTRIBUTE),不足返回 `409`:
  `{ "error": "样品库存不足:当前可发放 72 盒,申请发放 9999 盒" }`
- `quantity` 必须为正整数

### GET /api/visits/:id
拜访详情(结构同列表项)。

### PATCH /api/visits/:id
更新标量字段:`hcpId | hcoId | type | purpose | purposes | outcome | duration | notes | summary | nextStep | aiSummary | aiSentiment | jointWithId | receiverId | visitDate`。
**不处理** `products` / `samples` / `checkins` 明细的替换;有效性评定字段**不可**经此接口修改(请用 evaluate)。
AI 富化字段(`aiSummary`/`aiSentiment`)设计为由 AI 工具通过此接口回写。

### POST /api/visits/:id/evaluate
经理评定拜访有效性("上级反馈"流程):

```json
// 请求
{ "action": "VALID",   "evaluatorId": "cm…" }
{ "action": "INVALID", "evaluatorId": "cm…", "reason": "内容过短" }
// 响应 200:更新后的完整 visit(validityStatus/evaluatedBy/evaluatedAt/invalidReason 已写入)
```

业务规则:
- 仅 `PENDING`(未反馈)状态可评定;重复评定返回 `409` `{ "error": "该拜访已评定为 VALID,不能重复评定" }`
- `action=INVALID` 必须提供 `reason`(写入 `invalidReason`);`VALID` 会清空 `invalidReason`
- `evaluatorId` 必填且必须存在;写入 `evaluatedById` 与 `evaluatedAt`(服务器当前时间)
- 常见无效原因(前端预设):重复拜访记录 / 内容过短 / 签到地点不对 / 结果未体现

### POST /api/visits/:id/checkins
为已有拜访补一条签到:

```json
// 请求
{ "employeeId": "cm…",              // 可选,默认 = 该拜访的填写人
  "checkinTime": "2026-07-24T10:25:00+08:00", // 可选,默认当前时间
  "locationName": "苏州大学附属第一医院",
  "latitude": 31.30, "longitude": 120.62 }
// 响应 201:创建的 CheckIn 对象
```

`status` 缺省规则:若 `locationName` 与拜访机构名不一致,自动标记 `LOCATION_MISMATCH`(地点异常),否则 `NORMAL`;也可显式传 `status` 覆盖。

### GET /api/evaluations/pending?evaluatorId=xx(必填)
**我的待评定收件箱**:`receiverId = evaluatorId` 且 `validityStatus = PENDING` 的拜访列表,
按 `visitDate` 降序,每条含填写人 `employee` / 医生 `hcp` / 医院 `hco` / `purposes` / `summary` / `checkins`。

```json
{
  "data": [
    { "id": "cm…", "visitDate": "2026-07-24T08:15:00.000Z", "type": "FACE_TO_FACE",
      "purposes": "产品信息传递,临床信息沟通", "summary": "本次拜访…", "validityStatus": "PENDING",
      "employee": { "id": "cm…", "name": "刘洋", "role": "MR" },
      "hcp": { "id": "cm…", "code": "DR0001", "name": "张明远", "tier": "A" },
      "hco": { "id": "cm…", "code": "HOS001", "name": "苏州大学附属第一医院" },
      "checkins": [ { "id": "cm…", "checkinTime": "2026-07-24T08:10:00.000Z",
                      "locationName": "苏州大学附属第一医院", "status": "NORMAL" } ] }
  ],
  "total": 96
}
```

---

## 6. 周计划 Tour Plans

### GET /api/tour-plans
Query:`employeeId`、`status`、`weekStart`(ISO,精确匹配周一 0 点)。返回含 `employee` 与 `items[]`(每项含 `hcp` 摘要及其 `hco`)。

### POST /api/tour-plans
```json
// 请求
{ "employeeId": "cm…", "weekStart": "2026-07-27",
  "items": [
    { "planDate": "2026-07-27T09:00:00+08:00", "hcpId": "cm…", "note": "重点客户拜访" },
    { "planDate": "2026-07-28T09:00:00+08:00", "hcoName": "华东医药股份有限公司", "note": "商业对接" }
  ] }
// 响应 201:status=DRAFT 的完整计划
```
`items[]` 中 `hcpId` 与 `hcoName`(自由文本机构)二选一或都不填;`planDate` 必填。

### POST /api/tour-plans/:id/submit
提交审批:`DRAFT | REJECTED → SUBMITTED`(清空 `rejectReason`)。其他状态返回 `409`。无请求体。

### POST /api/tour-plans/:id/review
经理审批,仅 `SUBMITTED` 状态可审:
```json
// 请求
{ "action": "APPROVE", "approverId": "cm…" }
{ "action": "REJECT",  "approverId": "cm…", "reason": "计划覆盖 A 级客户不足" }
// APPROVE → status=APPROVED,写 approverId/approvedAt
// REJECT  → status=REJECTED,必须提供 reason(写入 rejectReason)
```

---

## 7. 样品 Samples

### GET /api/samples/inventory?employeeId=xx(必填)
代表样品库存,按产品聚合:**当前库存 = 领用总量(RECEIVE)− 发放总量(DISTRIBUTE)**,含批次明细。

```json
{
  "employee": { "id": "cm…", "name": "刘洋", "role": "MR" },
  "data": [
    { "product": { "id": "cm…", "brand": "安瑞泽", "molecule": "奥希替尼", "unit": "80mg*30片/盒" },
      "received": 83, "distributed": 9, "current": 74,
      "lots": [ { "lotId": "cm…", "lotNumber": "LOT-安202635-1",
                  "expiryDate": "2027-08-27T16:00:00.000Z",
                  "received": 83, "distributed": 9, "current": 74 } ] }
  ]
}
```

### GET /api/samples/lots?productId=(可选)
批次列表,含每批次 `received`(累计被领用)/ `distributed`(累计被发放)/ `remaining = totalQty − received`。

---

## 8. 医学会议 Events

### GET /api/events
Query:`from`、`to`(按 eventDate 过滤)。返回含 `_count.attendees`。

### POST /api/events
```json
{ "name": "心衰规范化诊疗研讨会", "type": "学术研讨会",   // name/type/eventDate 必填
  "eventDate": "2026-08-15T14:00:00+08:00",
  "location": "苏州金鸡湖会议中心", "budget": 20000,
  "attendeeHcpIds": ["cm…", "cm…"] }                       // 可选,逐个校验存在性
// 响应 201:含 attendees[].hcp 摘要
```

### GET /api/events/:id
会议详情,含参会医生列表(`attendees[].hcp` 及其 `hco` 摘要)。

---

## 9. 分析 Analytics

### GET /api/analytics/dashboard?employeeId=xx(必填)[&asOf=YYYY-MM-DD]
个人工作台。`employeeId` 为管理岗(ASM/RSM/ADMIN)时自动聚合整个下属子树;MR 仅统计本人。
`asOf` 把"今天"钉在指定日期(种子数据基准 `2026-07-24`)。

```json
{
  "employee": { "id": "cm…", "name": "王建国", "role": "RSM", "division": "肿瘤线" },
  "scope": { "employeeCount": 9, "isManager": true },
  "asOf": "2026-07-24T00:00:00.000Z",
  "todayVisits": 32,
  "week": { "weekStart": "2026-07-19T16:00:00.000Z", "plannedVisits": 30, "completedVisits": 152, "completionRate": 5.067 },
  "month": { "period": "2026-07", "visits": 508, "visitTarget": 720, "attainmentRate": 0.706, "salesTarget": 8412000 },
  "visitTrend14d": [ { "date": "2026-07-11", "count": 33 }, … ],
  "hcpTierDistribution": { "A": 6, "B": 15, "C": 9 },
  "pendingEvaluations": 96
}
```

字段口径:
- `todayVisits`:asOf 当日拜访数
- `week`:本周(周一为起点)计划条目数 vs 实际拜访数;`completionRate = completed/planned`(无计划时为 `null`,可 >1)
- `month.attainmentRate = visits / visitTarget`(目标为 scope 内 Target.visitTarget 之和)
- `visitTrend14d`:近 14 天逐日拜访数(含 0 值天)
- `hcpTierDistribution`:scope 员工辖区(含下级辖区)内 HCP 的 A/B/C 分布
- `pendingEvaluations`:**仅管理岗返回**;接收人是我(`receiverId = employeeId`)且 `validityStatus = PENDING` 的拜访数(待我评定),前端点击跳 `/evaluations`

### GET /api/analytics/territory?employeeId=xx(必填)[&asOf=YYYY-MM-DD]
辖区效能分析,按下属代表(MR)逐人聚合本月数据;employeeId 为 MR 时只返回本人。

```json
{
  "employee": { "id": "cm…", "name": "李强", "role": "ASM" },
  "period": "2026-07",
  "data": [
    { "employee": { "id": "cm…", "name": "张伟", "division": "肿瘤线",
                    "territory": { "id": "cm…", "name": "苏州办事处" } },
      "visitCount": 83, "coveredHcpCount": 16,
      "aTier": { "total": 2, "covered": 2, "coverageRate": 1 } }
  ]
}
```

字段口径:
- `visitCount`:本月拜访数
- `coveredHcpCount`:本月拜访过的去重 HCP 数
- `aTier.total`:该代表辖区(含下级)内 A 级 HCP 总数
- `aTier.covered`:本月拜访过的**辖区内** A 级 HCP 数;`coverageRate = covered / total`

### GET /api/analytics/employee-visits?employeeId=xx(必填)[&from=YYYY-MM-DD][&to=YYYY-MM-DD]
员工某段时间拜访情况聚合(一次调用拿多维汇总)。`from`/`to` 为闭区间,缺省 = 最近 14 天(含今天)。

```json
{
  "employee": { "id": "cm…", "name": "刘洋", "role": "MR", "division": "肿瘤线" },
  "range": { "from": "2026-07-11T00:00:00.000Z", "to": "2026-07-24T00:00:00.000Z", "days": 14 },
  "totalVisits": 57,
  "dailyBreakdown": [ { "date": "2026-07-11", "count": 4 }, … ],
  "byType": [ { "type": "FACE_TO_FACE", "count": 40 }, { "type": "PHONE", "count": 12 }, … ],
  "byValidity": [ { "status": "VALID", "count": 30 }, { "status": "PENDING", "count": 25 }, … ],
  "bySource": [ { "source": "MANUAL", "count": 50 }, { "source": "AI", "count": 7 } ],
  "topHcps": [ { "hcpId": "cm…", "name": "张*远", "count": 6 }, … ],
  "coveredHcpCount": 21,
  "jointVisitCount": 3,
  "avgPerDay": 4.071
}
```

字段口径:
- `dailyBreakdown`:范围内逐日拜访数(含 0 值天)
- `byType` / `byValidity` / `bySource`:按拜访类型 / 有效性(PENDING|VALID|INVALID)/ 来源(MANUAL|AI|IMPORT)分组计数,按数量降序
- `topHcps`:拜访次数最多的前 10 位医生(姓名脱敏),`coveredHcpCount` 为范围内拜访过的去重医生数
- `jointVisitCount`:协同拜访数(`type = JOINT` 或带有协同人 `jointWithId`)
- `avgPerDay = totalVisits / range.days`(按自然日,含无拜访天)

---

## 10. 部门树 Departments(五级行政组织)

独立于 Territory 辖区的行政组织树:1=事业部 → 2=战区 → 3=分管区 → 4=区 → 5=办事处。

### GET /api/departments
返回嵌套 `children` 的部门树,每个节点含该部门直属员工数 `employeeCount`。

```json
{
  "data": [
    { "id": "cm…", "name": "综合创新产品事业部", "level": 1, "parentId": null, "employeeCount": 0,
      "children": [
        { "id": "cm…", "name": "中部战区A", "level": 2, "parentId": "cm…", "employeeCount": 0,
          "children": [
            { "id": "cm…", "name": "苏皖分管区A", "level": 3, "parentId": "cm…", "employeeCount": 0,
              "children": [
                { "id": "cm…", "name": "南京区A", "level": 4, "parentId": "cm…", "employeeCount": 0,
                  "children": [
                    { "id": "cm…", "name": "南京一办事处", "level": 5, "parentId": "cm…", "employeeCount": 2, "children": [] }
                  ] }
              ] }
          ] }
      ] }
  ],
  "total": 9
}
```

员工与部门的关联见 `GET /api/employees` 的 `department` / `departmentPath` 字段。

---

## 11. 客户统计 Customer Stats(第三阶段)

### GET /api/customers/stats?type=hcp|hco&employeeId=(可选)
客户分级统计卡(对齐客户管理页顶部统计卡):

```json
{ "total": 120, "mine": 18, "ungraded": 12, "tierA": 30, "tierB": 45, "tierC": 25, "tierD": 8 }
```

- `type` 必填:`hcp` | `hco`
- `mine`:该 employeeId 有分配关系(OWNER/COLLAB)的客户数;不传 employeeId 时为 `0`
- `ungraded`:tier 为 null(未分级)的客户数

---

## 12. 客户分配 Assignments(第三阶段)

客户-代表多对多分配(对齐"合作办事处/合作代表"多值)。`role`:`OWNER`=负责(默认)| `COLLAB`=协作。

### POST /api/assignments

```json
// 请求(hcpId 与 hcoId 二选一)
{ "hcpId": "cm…", "employeeId": "cm…", "role": "COLLAB" }
// 响应 201:创建的分配关系(含 employee 摘要:姓名 + 所属办事处)
```

校验:`hcpId`/`hcoId` 必须二选一(400);员工/客户不存在 404;`role` 非法 400;
完全相同的(客户 + 员工 + role)重复分配返回 `409`。

### DELETE /api/assignments/:id
解除一条分配关系。不存在返回 404。响应 `{ "ok": true, "id": "cm…" }`。

---

## 13. 建档审批 Applications(第三阶段)

建档工作流(对齐截图:暂存草稿 / 立即创建 + 管理端审核 + 客户核决):
`DRAFT`(暂存草稿)→ `PENDING`(已提交待审核)→ `APPROVED` / `REJECTED`。
APPROVE 时按 `type` 用 `payload` 落地:CREATE 类创建正式 HCP/HCO 档案
(含 educations/bankAccounts/departments 等子记录),**申请人自动成为该客户的 OWNER 代表**;
MODIFY 类用 payload 标量字段更新目标档案。

### POST /api/applications

```json
// 请求
{ "type": "HCP_CREATE",                       // HCP_CREATE | HCO_CREATE | HCP_MODIFY | HCO_MODIFY
  "applicantId": "cm…",                       // 申请人(必填,必须存在)
  "pool": "架构客户池",                        // 可选:客户池
  "submit": false,                            // false=暂存草稿 DRAFT(默认);true=立即提交 PENDING
  "targetHcpId": "cm…",                       // 仅 MODIFY 类必填(也可放在 payload 内)
  "payload": { "name": "新医生", "specialty": "肿瘤内科",
               "educations": [ … ], "bankAccounts": [ … ] } }
// 响应 201:创建的申请对象(payload 存为 JSON 字符串)
```

### GET /api/applications?status=&applicantId=&type=
申请列表,按 `createdAt` 倒序(上限 200)。`status` / `type` 非法值返回 400。

### GET /api/applications/:id
申请详情,附带 `parsedPayload`(payload 解析后的对象)。

### POST /api/applications/:id/submit
提交审核:`DRAFT → PENDING`。其他状态返回 `409`。无请求体。

### POST /api/applications/:id/review

```json
// 请求
{ "action": "APPROVE", "reviewerId": "cm…" }
{ "action": "REJECT",  "reviewerId": "cm…", "reason": "资料不完整,请补充执业证书" }
```

业务规则:
- 仅 `PENDING` 状态可审;重复审核返回 `409`
- `REJECT` 必须提供 `reason`(400);`reviewerId` 必填且必须存在(404)
- `APPROVE` 落地成功后写入 `createdHcpId` / `createdHcoId`,并创建申请人 OWNER 分配(CREATE 类)

---

## 开发命令

```bash
npm run dev            # 开发服务器,端口 5618
npm run build          # 生产构建(含类型检查与 ESLint)
npx prisma migrate dev # 应用迁移
npx prisma db seed     # 重置并写入种子数据(先清空全部表)
npm run enrich:v2      # 客融CRM 档案体系扩展数据适配(不丢现有数据,幂等)
npx prisma studio      # 数据浏览
```

## 数据规模(种子后)

员工 9(工号 YG1001-YG1009)· 部门 9(五级树:1 事业部→1 战区→1 分管区→2 区→4 办事处)· 辖区 7
机构 11(8 医院 + 2 药店 + 1 商业公司,编码 HOS001+)· HCP 30(A:B:C = 6:15:9,编码 DR0001+)
产品 6(肿瘤线/心血管线各 3)· 样品批次 7 · 样品事务 125
拜访 494(近 14 天;有效 304 / 无效 17 带原因 / 待评定 173;约 7% 来源为 AI)· 签到 494(地点异常 17)
周计划 6(APPROVED/SUBMITTED/DRAFT 各 2)· 会议 2 · 本月 Target 18
