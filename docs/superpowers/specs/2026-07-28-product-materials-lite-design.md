# 产品合规沟通资料 Lite 设计

日期：2026-07-28  
状态：已确认，进入实施  
目标：在演示版中完成产品批准资料从版本管理、拜访选择到历史使用追溯的最小闭环。

## 1. 范围

本期实现：

- 产品资料版本、合规话术摘要和外部 `http/https` 链接。
- `DRAFT / APPROVED / RETIRED` 三态流转。
- 版本、生效日期、失效日期和批准编号。
- 产品页资料查看、新建、批准和停用。
- 拜访表单只选择当前有效且已批准的资料。
- 拜访提交时服务端再次校验资料。
- 拜访详情和 HCP 360 展示资料使用版本快照。
- 固定演示资料数据。

不实现文件上传、对象存储、电子审批、下载鉴权、水印、渠道权限、全文搜索和通用内容管理系统。

## 2. 数据模型

```prisma
model ProductMaterial {
  id             String   @id @default(cuid())
  productId      String
  product        Product  @relation(fields: [productId], references: [id])
  title          String
  type           String
  messageSummary String
  externalUrl    String
  version        String
  approvalCode   String?
  effectiveDate  DateTime
  expiryDate     DateTime
  status         String   @default("DRAFT")
  usages         VisitMaterialUsage[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([productId, version])
  @@index([productId, status, effectiveDate, expiryDate])
}

model VisitMaterialUsage {
  id                   String          @id @default(cuid())
  visitId              String
  visit                Visit           @relation(fields: [visitId], references: [id], onDelete: Cascade)
  materialId           String
  material             ProductMaterial @relation(fields: [materialId], references: [id])
  titleSnapshot        String
  versionSnapshot      String
  approvalCodeSnapshot String

  @@unique([visitId, materialId])
}
```

资料类型只使用 `DETAIL_AID`、`SLIDE_DECK`、`PATIENT_EDUCATION`、`CLINICAL_REPRINT`。

## 3. 业务规则

资料当前可用必须同时满足：

1. 状态为 `APPROVED`。
2. `effectiveDate <= 使用日期 < expiryDate`。
3. 批准编号非空。
4. 外部链接协议为 `http` 或 `https`。

状态流转：

- `DRAFT -> APPROVED`
- `DRAFT -> RETIRED`
- `APPROVED -> RETIRED`
- `RETIRED` 为终态。

批准时重新校验批准编号、日期和链接。失效日期必须晚于生效日期。

拜访资料必须属于同一次拜访已选择的产品。重复资料 ID 去重。提交事务中重新读取并校验；任何一条不合法则整个拜访不创建。使用记录保存标题、版本和批准编号快照，资料后续停用不影响历史显示。

## 4. 页面与 API

产品页每张产品卡增加“合规资料”区：

- 展示标题、类型、版本、批准编号、有效期和状态。
- 有效资料使用绿色标识，即将到期使用黄色，失效/停用使用灰色。
- 创建资料对话框默认保存为草稿。
- 草稿可批准；草稿或已批准资料可停用。

拜访表单选择产品后加载其当前可用资料，以复选框多选。取消产品时同步取消其资料。提交 payload 增加 `materialIds`。

拜访详情/HCP 360 在产品反馈附近展示“使用资料：标题 · 版本 · 批准编号”。

API：

```text
GET   /api/product-materials?productId=<id>&availableOn=YYYY-MM-DD
POST  /api/product-materials
PATCH /api/product-materials/[id]
```

`GET` 未提供 `availableOn` 时返回该产品全部版本；提供时只返回当日可用资料。

## 5. 演示数据

至少三个重点产品各有资料，并覆盖：

- 当前有效且已批准。
- 30 天内即将到期。
- 已停用的历史版本。

至少一条既有拜访关联有效资料快照，HCP 360 可直接展示。

## 6. 测试与验收

单元测试：

- 状态流转。
- 当前可用判断与有效期边界。
- URL 协议。
- 必填字段、日期和批准编号。
- 拜访所选资料必须属于已选产品。

数据/API 测试：

- 同产品版本唯一。
- 非法资料不能批准。
- 失效、草稿和跨产品资料不能用于拜访。
- 重复资料去重。
- 历史快照不随资料停用变化。

浏览器验收：

1. 产品页展示有效、即将到期和历史资料。
2. 新建草稿后可以批准或停用。
3. 拜访选择产品后只出现有效资料。
4. 提交后 HCP 360 展示资料版本快照。
5. Seed 重置恢复固定场景。

