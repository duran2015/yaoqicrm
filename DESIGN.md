# DESIGN.md — 设计溯源

本文档说明本项目每个核心设计**借鉴了哪个开源项目(或商业产品概念模型)的哪个优点**,
以及为什么这样取舍。

## 背景:为什么自研

调研开源社区后发现两个空白:

1. **开源界没有成熟的 pharma CRM/SFA**。相关仓库(如 `MR-Reporting-System`、
   `sopan-pharma-sfa-suite`)star 数最高仅 5★ 左右,功能停留在 CRUD 演示层面,
   缺少完整领域模型(样品批次/事务、周计划审批流、辖区效能分析)。
2. **没有任何面向 pharma 场景的 MCP server**。已有的 CRM MCP server(如 twenty 的)
   面向通用销售场景,不含 HCP 分级、样品合规、DCR 日报等行业概念。

因此本项目定位为**填补空白的演示实现**:以 Veeva CRM 概念模型为骨架,融合若干开源
项目的具体优点,再叠加一层 AI 友好(MCP)的访问协议。

---

## 1. sopan-pharma-sfa-suite(poks5/sopan-pharma-sfa-suite)

一套基于 Web 的印度药企 SFA(Sales Force Automation)套件,是开源界少见的
"完整业务流"尝试。本项目借鉴:

- **销售组织层级 `reports_to` 自关联**:`Employee.reportsToId` 自引用形成
  MR → ASM → RSM 汇报树,分析接口按"下属子树"聚合(scope 递归)即源于此。
- **辖区树(Territory tree)**:`Territory.parentId` 构成 ZONE(大区)→ REGION(地区)
  → AREA(办事处)三级树,HCO 挂在辖区上,辖区覆盖率统计沿树下钻。
- **产品三级主数据**:`Product.brand`(商品名)→ `molecule`(通用名/分子)→
  `therapeuticCategory`(治疗领域)的三级结构,外加 `division`(事业部)维度,
  与该项目的产品主数据管理思路一致。
- **DCR(Daily Call Report)拜访日报**:`Visit` 作为最核心事实表,承载"今天见了谁、
  谈了什么、结果如何"的日报语义。
- **协同拜访(joint call)**:`Visit.type = JOINT` + `jointWithId` 记录经理协同拜访,
  是 SFA 套件中经理辅导(coaching)场景的标准做法。

## 2. abhishekasthana-251/ai-first-crm-hcp-module

一个"AI-first"的 HCP 模块实验项目,核心主张是 CRM 应天然为 AI 代理设计访问接口。
本项目借鉴:

- **AI 友好的原子工具划分**:MCP 工具不做"大而全"的万能接口,而是按 LLM 决策粒度
  切成 13 个单一职责原子工具(搜医生 → 看全景 → 记拜访 → 查库存 …),
  每个工具的输入 schema 都是最小完备集。
- **拜访记录 AI 富化字段**:`Visit.aiSummary` / `Visit.aiSentiment` 两个字段
  预留给 AI 回写(`update_visit_ai_fields` 工具 + `PATCH /api/visits/:id`),
  把"AI 阅读原始 notes → 生成摘要/情感倾向"固化为数据模型的一等公民,
  而不是事后外挂的报表。
- **`analyze_territory_performance` 工具设计**:管理者视角的辖区效能聚合
  (拜访数/覆盖医生数/A 级覆盖率),直接对应 AI 助手"帮我看看团队谁的
  A 级客户覆盖不足"这类高频提问。

## 3. mhenry3164/twenty-crm-mcp-server

Twenty CRM 的非官方 MCP server,是"description 驱动"实践的成熟样本。本项目借鉴:

- **工具 description 驱动 LLM 选择**:MCP 协议中 LLM 只能看到工具名、description
  和 input schema——description 的质量直接决定 AI 能否选对工具。本项目所有工具的
  description 都遵循该项目的写法:第一句说清"做什么+什么时候用",参数逐个标注
  中文业务含义(枚举值逐个解释),并在 description 里写明工具间协作关系
  (如"发放样品前应先查库存拿 lotId")。
- **薄封装原则**:MCP server 不重复实现业务逻辑,只做 REST API 的 1:1 语义映射 +
  错误透传,保持服务端单一事实源。

## 4. swarpatel23/MR-Reporting-System

经典的医药代表日报系统(PHP),覆盖 MR 日常核心动作。本项目借鉴:

- **周计划提交 → 经理审批工作流**:`TourPlan` 状态机
  `DRAFT → SUBMITTED → APPROVED / REJECTED`(REJECTED 可修改后重新提交),
  驳回必须填 `rejectReason`,审批记录 `approverId` / `approvedAt`,
  完整复刻了 MR 系统中"计划先行、经理把关"的管理闭环。

## 5. Veeva CRM 概念模型(商业产品,行业事实标准)

Veeva 是 pharma CRM 的行业事实标准,其概念模型经受了全球药企合规检验。
本项目在演示尺度内对齐:

- **HCP/HCO 统一建模**:医生(Hcp)与医疗机构(Hco,医院/药店/商业公司)分离又关联,
  拜访可同时挂 HCP 与 HCO,支持"对人"和"对机构"两种业务视角。
- **Call + 明细行结构**:`Visit`(call 头)+ `VisitProduct`(讨论产品明细行)+
  `SampleTransaction`(样品明细行),一次拜访讨论多产品、发放多样品,
  与 Veeva Call 的 header/detail 结构一致。
- **Sample Lot / Transaction 双层**:样品批次(SampleLot,含批号/效期/总量)与
  样品事务(SampleTransaction,RECEIVE 领用 / DISTRIBUTE 发放)分离,
  代表库存 = 累计领用 − 累计发放,由事务推导而非冗余存储——这是样品合规
  (sample accountability)审计的标准做法。
- **HCP A/B/C 分级**:`Hcp.tier` 分级驱动差异化覆盖策略,
  辖区效能分析专门统计"A 级覆盖率",与 Veeva 的 targeting/coverage 方法论一致。

---

## 附:设计取舍说明

- **SQLite 单文件**:演示项目零外部依赖优先;Prisma 抽象保证可平滑迁移 PostgreSQL。
- **`asOf` 参数钉住"今天"**:种子数据有固定时间基准(2026-07-24),
  分析接口暴露 `asOf` 让演示/测试可复现,这也是 AI 工具调参时的显式约定。
- **MCP 工具的"当前身份"内存态**:`set_current_employee` 把多轮对话中的
  "我是谁"固化为会话状态,避免每次调用都重复传 employeeId——
  这是上述开源项目都没有、而对话式 AI 场景必需的设计。

---

## 6. 对照外部 CRM 导出格式的字段补全

第二阶段参考外部 CRM 的拜访导出格式,逐列分析一期模型的缺口并补齐:

- **行政组织与辖区分离**:导出格式中员工同时挂在「事业部→战区→分管区→区→办事处」的
  五级行政树和独立的销售辖区上。因此新增 `Department` 五级自引用树(level 1-5),
  与既有 `Territory`(ZONE/REGION/AREA)并存,员工同时挂两边;
  员工增加唯一工号 `employeeCode`(YG1001+),HCP/HCO 增加唯一编码 `code`(DR0001+/HOS001+)。
- **拜访目的结构化多选**:真实导出里拜访目的是「产品信息传递，临床信息沟通」式的
  逗号组合枚举值。模型新增 `Visit.purposes`(逗号分隔,5 项枚举:产品信息传递/临床信息沟通/
  市场现状调研/学术会议沟通/其他),旧自由文本 `purpose` 保留不动作向后兼容。
- **人工总结与 AI 摘要并存**:导出格式中"拜访总结"(人工写)与 AI 摘要是两个独立字段,
  因此 `summary` 与 `aiSummary` 并列,前端分开展示且 AI 摘要带 "AI" 标记;
  `source`(MANUAL/AI/IMPORT)区分录入来源。
- **上级接收 + 有效性评定闭环**:真实流程是代表提交拜访 → 抄送直属上级(`receiverId`,
  默认=填写人 reportsTo)→ 经理在收件箱反馈 有效/无效,无效必须填原因
  (常见值:重复/内容过短/签到地点不对/结果未体现)。
  `validityStatus` 默认 PENDING,仅 PENDING 可评定(重复评定 409),
  评定写 `evaluatedById`/`evaluatedAt`/`invalidReason`——与 TourPlan 审批同一套"状态机 + 留痕"思路。
- **签到 CheckIn 独立成行**:每条拜访可绑定一条签到(时间/地点/经纬度),
  地点与拜访机构不一致即「地点异常」。建模为独立 `CheckIn` 表(1 拜访对 N 签到,
  级联删除),补签到走 `POST /api/visits/:id/checkins` 并自动判定 `LOCATION_MISMATCH`。

---

## 7. 对照正大天晴"客融CRM"截图的档案体系扩展

第三阶段拿到正大天晴"客融CRM"的 6 张系统截图(HCO 详情页 5 分区、HCP 详情页 6 分区、
客户管理列表页统计卡、建档表单页"暂存草稿/立即创建"、管理端审核页、客户核决页),
按"截图里有什么字段,我们就建什么模"的原则补齐客户主数据体系:

- **HCO 五分区全档案**:基础(统一社会信用代码/省市区/曾用名/经营状态)、工商(注册资本/
  成立日期/法人/经营范围)、机构(公立民营/综合专科中医/是否军队/医保/临床试验机构/
  教学类型/诊疗科目/ICU·开放·核定床位)、管理(医生数/年药品采购额/日门诊/年手术/
  年住院/优势病种/药占比)、合作(是否战略客户/合作状态/客户分类 目标·潜力·观察医院/
  KA 负责人 `kaOwnerId`)。全部新字段可空,additive 迁移不丢 3.4 万条真实拜访。
- **HCP 六分区全档案**:基础(性别/生日/医师资格证号)、工作(行政职务/学术职称/医生等级/
  是否多点执业·网络问诊·临床PI·组长·药事会成员/执业范围/周门诊量/管理床位/擅长疾病/
  执业证书·职称证书编号)、其他(邮箱/籍贯/爱好/性格标签/家庭住址)、证件(证件类型/号码),
  外加 1-N 子表 `HcpEducation`(教育经历)与 `HcpBankAccount`(银行账户)。
- **分级体系升级为 A/B/C/D + 未分级(null)**:截图统计卡显示"未分级"是一等公民
  (1778/1831),因此 `tier` 改为可空,`null`=未分级;分级调整走
  `POST /api/hcp|hco/:id/tier`,每次变更写 `CustomerTierHistory`(fromTier/toTier/
  changedById/reason/changedAt)——与拜访有效性评定、周计划审批同一套"状态机 + 留痕"思路。
- **客户-代表多对多分配 `CustomerAssignment`**:截图"合作办事处/合作代表"为多值,
  建模为独立分配表(role=OWNER 负责 / COLLAB 协作),从 3.4 万条真实拜访提炼
  (employeeId, hcpId)/(employeeId, hcoId) 去重对回填 OWNER,使"我的客户"(mine)
  统计有真实业务来源而非凭空造数。
- **建档审批工作流 `CustomerApplication`**:对齐"暂存草稿/立即创建 + 管理端审核 +
  客户核决"三段式——DRAFT(暂存草稿)→ PENDING(提交待审核)→ APPROVED/REJECTED;
  表单整体存 JSON `payload`,APPROVE 时按 type 落地为正式 HCP/HCO(含教育/账户/科室子记录),
  申请人自动成为 OWNER 代表,REJECT 必须填原因,重复审核 409。支持客户池(pool)字段。
- **敏感字段全局脱敏**:与真实系统一致,姓名(冶*玲,保留首尾字)、手机号(前 3 后 2)、
  证件号(前 3 后 2)、银行账号(前 4 后 2)在 API 输出层统一脱敏(`src/lib/mask.ts`),
  数据库存原文——脱敏是"展示层职责",不污染存储与检索。
- **HCO 子档案 tabs**:科室 `HcoDepartment`(标准科室/特色/排名/概况)、进院产品
  `HcoProduct`(ENTERED 已进院 / POOL 客户池)、国考成绩 `HcoExamResult`
  (国家三级公立医院绩效考核,A++/A+/A/B++)——对应截图 HCO 详情页的三个 tab。
