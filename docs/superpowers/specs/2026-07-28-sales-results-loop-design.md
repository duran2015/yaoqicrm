# 销售结果闭环设计

日期：2026-07-28  
状态：已确认，进入实施  
目标：为宣传演示补齐“销售目标—实际销量—活动关联—业务下钻”闭环。

## 1. 范围

本期实现：

1. 按月展示目标金额、实际金额、金额达成率和实际金额环比。
2. 同时保存并展示目标数量、实际数量。
3. 支持产品、HCO、代表三个维度汇总和下钻。
4. 展示拜访覆盖、会议、Account Plan 已完成里程碑与同期销售结果的关联。
5. 提供固定六个月演示数据。
6. 提供 CSV 示例、上传预览、逐行校验和确认导入。
7. 在代表首页和经理工作台提供销售结果摘要与分析入口。

本期不实现订单明细、商业流向对账、预测、归因模型、相关系数、审批、异步队列、Excel、多币种和生产级权限。

## 2. 数据口径

销售结果的最小粒度为：

> 月份 × 产品 × HCO × 代表

每条事实包含：

- 目标金额与实际金额，使用人民币分的非负整数保存。
- 目标数量与实际数量，使用非负整数保存。
- 月份保存为上海业务月份第一天。

同一月份、产品、HCO、代表构成唯一业务键。重复导入执行覆盖更新，不累计。

金额达成率为实际金额除以目标金额。目标金额为零时返回空值，界面显示“—”。实际金额环比以上月实际金额为基准；上月为零且本月大于零时显示“新增”，两月均为零时显示 0%。

## 3. 数据模型

### 3.1 SalesResult

```prisma
model SalesResult {
  id                   String   @id @default(cuid())
  month                DateTime
  productId            String
  hcoId                String
  employeeId           String
  targetAmountCents    Int
  actualAmountCents    Int
  targetQuantity       Int
  actualQuantity       Int
  importBatchId        String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  product              Product  @relation(fields: [productId], references: [id])
  hco                  Hco      @relation(fields: [hcoId], references: [id])
  employee             Employee @relation(fields: [employeeId], references: [id])
  importBatch           SalesImportBatch? @relation(fields: [importBatchId], references: [id])

  @@unique([month, productId, hcoId, employeeId])
  @@index([month])
}
```

### 3.2 SalesImportBatch

```prisma
model SalesImportBatch {
  id            String        @id @default(cuid())
  fileName      String
  importedById  String
  status        String
  totalRows     Int
  successRows   Int
  failedRows    Int
  errorSummary  String?
  createdAt     DateTime      @default(now())
  results       SalesResult[]
}
```

批次状态只使用 `PREVIEWED`、`COMPLETED`、`FAILED`。演示版不保存原始文件。

## 4. CSV 导入

CSV 使用 UTF-8，第一行为固定表头：

```text
month,productCode,hcoCode,employeeCode,targetAmount,actualAmount,targetQuantity,actualQuantity
```

- `month` 接受 `YYYY-MM`。
- 金额以元输入，最多两位小数，转换为分。
- 数量必须为非负整数。
- 产品、HCO、员工通过唯一编码解析。
- 产品事业部必须与员工事业部一致。
- 单次最多 5,000 条数据行。
- 同一文件内重复业务键以最后一行作为预览结果，同时返回覆盖提示。

上传只执行解析和预览，不写数据库。预览返回有效行、错误行、提示和覆盖统计。确认接口重新校验预览载荷并在单个事务内 upsert；任何数据库错误整批回滚并记录失败批次。

演示版不建设临时文件、异步作业和可恢复上传会话。

## 5. 聚合与活动关联

销售汇总支持：

- 月份总览。
- 最近六个月趋势。
- 按产品汇总。
- 按 HCO 汇总。
- 按代表汇总。
- 指定维度对象的最近六个月明细。

活动关联使用相同月份、HCO 和产品进行确定性聚合：

- 拜访：仅统计 `SUBMITTED`，并统计拜访次数和去重 HCP 数；选择了产品的拜访计入对应产品，未选产品的拜访只计入 HCO 总活动量。
- 会议：统计已经开始且状态为进行中或已结束的会议；通过参会 HCP 的主要 HCO 关联，产品维度不做强行分摊。
- Account Plan：仅统计 `DONE` 里程碑；没有独立产品时关联计划的全部重点产品。

界面统一使用“活动关联”“同期变化”等措辞，不声明拜访、会议或里程碑导致销量增长。

## 6. 页面

### 6.1 `/sales-results`

销售结果总览包含：

- 月份选择。
- 目标金额、实际金额、金额达成率、实际金额环比。
- 目标数量、实际数量。
- 最近六个月金额趋势。
- 产品、HCO、代表三个下钻标签。
- 每个维度展示目标、实际、达成率、环比和详情入口。

维度详情使用查询参数，不增加三个重复页面：

```text
/sales-results?month=2026-07&dimension=product&id=<productId>
```

详情展示该对象最近六个月销售结果及每月活动关联。

### 6.2 `/sales-results/import`

导入页面提供：

- CSV 示例下载。
- 文件选择与上传预览。
- 有效行、错误行、覆盖行统计。
- 错误行号和明确原因。
- 确认导入按钮。
- 最近导入批次。

存在任何错误行时禁止确认；用户修正文件后重新预览。

### 6.3 首页与经理工作台

- MR 首页展示本人当月目标金额、实际金额、达成率和环比。
- 经理工作台展示下属团队当月同样四项指标。
- 两处均只提供摘要和“进入销售分析”入口，不复制下钻报表。

## 7. API

```text
GET  /api/sales-results/summary?month=YYYY-MM
GET  /api/sales-results/breakdown?month=YYYY-MM&dimension=product|hco|employee
GET  /api/sales-results/detail?month=YYYY-MM&dimension=...&id=...
GET  /api/sales-results/import-template
POST /api/sales-results/import-preview
POST /api/sales-results/import-confirm
GET  /api/sales-results/import-batches
```

所有错误返回现有 JSON 错误风格和正确 HTTP 状态：

- 400：月份、维度、CSV 或字段格式错误。
- 404：产品、HCO 或员工编码不存在。
- 409：预览载荷失效或确认内容与预览不一致。
- 413：超过 5,000 行。
- 500：事务失败。

## 8. 固定演示数据

Seed 创建截至 2026-07 的连续六个月数据，并覆盖三类故事：

1. 活动稳定、销售金额持续增长。
2. 活动增加后，销售金额在下一个月改善。
3. 覆盖不足且目标持续未达。

演示数据至少覆盖三个产品、三个 HCO 和三名代表，并与现有拜访、会议、Cycle Plan 和 Account Plan 数据对齐。重新执行 seed 后结果完全确定。

## 9. 测试与验收

单元测试：

- 上海业务月份解析。
- 金额元到分转换。
- 达成率和零目标。
- 环比、“新增”和双零。
- CSV 表头、字段、编码、负数、重复键和 5,000 行限制。
- 产品与代表事业部一致性。
- 活动关联规则。

API/数据测试：

- 预览不写数据库。
- 错误行阻止确认。
- 相同业务键覆盖更新。
- 确认失败整批回滚。
- 三个维度汇总与详情总额一致。
- 固定数据具有三类演示场景。

浏览器验收：

1. 总览显示六个月趋势和正确摘要。
2. 产品、HCO、代表均可下钻。
3. 详情显示销售结果及活动关联。
4. 非法 CSV 显示逐行错误且不能确认。
5. 合法 CSV 可确认导入并更新总览。
6. seed 重置后恢复固定数据。
7. MR 首页和经理工作台摘要与总览一致。

## 10. 后续边界

完成本规格后，再分别设计：

1. 产品合规沟通资料与拜访使用记录。
2. HCP 多机构、多科室任职。
3. Account Plan 策略编辑和代表首页聚合体验。

