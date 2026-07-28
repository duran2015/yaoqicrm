# 销售情报中心与 Agent 辅助设计

日期：2026-07-29  
状态：已确认整体方向，待书面规格复核

## 1. 背景与目标

现有 Pharma CRM 已经具备产品、HCP/HCO、拜访、代表工作台、合规产品资料、拜访资料使用留痕，以及 WorkBuddy → MCP → CRM 演示闭环。

本期目标不是继续扩展通用 CRM 功能，而是帮助药企销售和营销团队更充分地准备客户沟通、共享同一 SKU 的公共知识，并把行业变化转化为可执行的销售行动。

系统需要自动从互联网获取以下信息：

- 行业政策：医保、集采、准入、药监、卫生健康和地方政策。
- 竞品动态：获批、适应症、说明书、价格与准入变化、公开市场活动。
- 行业新闻：与治疗领域、产品和目标市场相关的可信医药新闻。
- 疾病知识：疾病概览、诊疗路径、患者分层和权威指南要点。
- 产品知识：适应症、目标患者、核心证据、常见问题，以及现有批准材料。

演示版必须形成真实闭环：

1. 定时或手动触发互联网采集；
2. 系统去重、分类、关联产品和治疗领域；
3. 管理员核验或驳回；
4. 代表在首页、产品、HCP 和拜访前简报看到相关情报；
5. WorkBuddy Agent 通过 MCP 检索、生成产品应对卡并辅助拜访准备；
6. 所有 Agent 结论保留来源、时间和核验状态；
7. 普通情报与可对外使用的批准材料严格区分。

## 2. 产品原则

### 2.1 情报不是批准话术

`SalesIntelligence` 是供内部准备使用的市场与知识情报。现有 `ProductMaterial` 仍是唯一可作为对外沟通材料的对象。

Agent 可以引用情报帮助代表理解背景、设计问题和准备异议处理，但不得把未批准的情报包装成可直接向 HCP 宣讲的话术。

### 2.2 白名单优先，搜索补充

- 白名单来源是自动采集主路径。
- 搜索引擎只用于补充覆盖。
- 搜索补充结果一律标记为 `PENDING_REVIEW`。
- 白名单结果也保留来源；只有满足自动核验规则时才能标记为 `VERIFIED`，否则仍进入待核验。

### 2.3 有来源才有结论

每条内容必须保存原始 URL、来源名称、发布时间（如可获得）、采集时间和内容指纹。

Agent 返回情报时必须携带来源。没有足够证据时应说明“未找到已核验信息”，不能补造事实。

### 2.4 先结构化检索，不建设通用知识中台

本期使用 SQLite、结构化关联和全文/关键词检索。暂不引入向量数据库、知识图谱、对象存储、OCR 平台或通用爬虫编排平台。

## 3. 用户与核心场景

### 3.1 代表

- 在首页查看与自己负责产品相关的高优先级新情报。
- 在产品页查看政策、竞品、疾病与产品知识。
- 在 HCP 详情查看与该 HCP 专科和历史沟通相关的内容。
- 在拜访前获取带来源的准备摘要、竞品应对建议和批准材料。
- 通过 WorkBuddy 自然语言查询，不需要记住 CRM 页面位置。

### 3.2 经理/营销运营

- 查看最新采集结果与待核验队列。
- 核验、驳回、归档信息，修正产品、竞品和治疗领域关联。
- 为重点 SKU 手动触发更新。
- 查看团队关注和使用情况，为后续内容运营提供依据。

### 3.3 系统

- 每日自动运行白名单采集。
- 支持管理员“立即采集”和指定产品更新。
- 对 URL 和正文内容去重。
- 保留来源变化历史，不静默覆盖已经使用过的事实。

## 4. 信息架构与页面

### 4.1 新增一级菜单：销售情报

默认页提供以下视图：

- 最新：按优先级和发布时间排序。
- 行业政策。
- 竞品动态。
- 行业新闻。
- 疾病与产品知识。
- 待核验。
- 采集记录。

列表筛选：

- 类型、核验状态、可信级别；
- 产品、治疗领域、竞品；
- 来源、发布日期范围；
- 关键词。

每张情报卡展示：

- 标题、三到五行摘要；
- 类型和重要级别；
- 来源名称、发布时间、采集时间；
- `已核验`、`待核验`、`已驳回` 或 `已归档`；
- 关联产品、治疗领域、竞品；
- 原文链接。

详情页展示正文摘录、来源信息、关联关系、版本历史和管理员操作。演示版不在 CRM 中镜像展示整篇受版权保护的新闻正文，只保留检索所需的合理摘录与原文链接。

### 4.2 现有页面嵌入

代表首页：

- 新增“与你相关的新情报”，最多五条；
- 只使用代表负责产品/事业部相关且未过期的内容；
- 高优先级政策和已核验竞品变化优先。

产品详情：

- 增加“市场与知识”区域；
- 按政策、竞品、疾病知识分组；
- 保留现有“合规资料”区域，明确视觉标签区分。

HCP 详情：

- 根据主要专科、机构和最近讨论产品展示相关情报；
- 不改变 HCP 主数据；
- 内容只用于拜访准备，不自动写入 HCP 标签。

拜访前简报：

- 在现有 HCP 360、历史拜访、待办、样品和批准材料之外，加入：
  - 近期已核验政策；
  - 已核验竞品变化；
  - 疾病/产品知识要点；
  - 待核验风险提示（默认折叠）；
  - 建议准备的问题与批准材料。

## 5. 数据模型

### 5.1 `IntelligenceSource`

代表一个可采集来源。

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `name` | 来源名称 |
| `baseUrl` | 来源域名或入口 |
| `sourceType` | `OFFICIAL`、`PROFESSIONAL`、`COMPANY`、`MEDIA`、`SEARCH` |
| `collectionType` | `RSS`、`LIST_PAGE`、`SEARCH`、`MANUAL` |
| `enabled` | 是否启用 |
| `trustLevel` | `AUTHORITATIVE`、`TRUSTED`、`REFERENCE` |
| `topicTypes` | 允许采集的内容类型 |
| `configJson` | 演示版适配器配置，不保存密钥 |
| `lastCollectedAt` | 最近成功采集时间 |
| `createdAt/updatedAt` | 审计时间 |

初始白名单包含国家医保局、国家药监局、国家卫健委、CDE 以及少量可稳定访问的省级医保/卫健来源。疾病指南和竞品来源按演示 SKU 配置。

### 5.2 `CollectionRun`

记录一次采集任务。

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `triggerType` | `SCHEDULED`、`MANUAL`、`PRODUCT_REFRESH`、`AGENT_SEARCH` |
| `sourceId` | 可选来源 |
| `productId` | 可选指定产品 |
| `status` | `PENDING`、`RUNNING`、`SUCCEEDED`、`PARTIAL`、`FAILED` |
| `startedAt/finishedAt` | 执行时间 |
| `foundCount/newCount/updatedCount/failedCount` | 统计 |
| `errorSummary` | 最小错误摘要 |
| `requestedById` | 手工或 Agent 触发人 |

### 5.3 `SalesIntelligence`

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `type` | `POLICY`、`COMPETITOR`、`INDUSTRY_NEWS`、`DISEASE_KNOWLEDGE`、`PRODUCT_KNOWLEDGE` |
| `title` | 标题 |
| `summary` | 供列表和 Agent 使用的摘要 |
| `contentExcerpt` | 合理长度的检索摘录 |
| `sourceId/sourceName` | 来源关联与快照 |
| `sourceUrl` | 原文 URL |
| `publishedAt` | 原文发布时间，可空 |
| `collectedAt` | 采集时间 |
| `validFrom/validUntil` | 内容有效期，可空 |
| `verificationStatus` | `PENDING_REVIEW`、`VERIFIED`、`REJECTED`、`ARCHIVED` |
| `confidence` | `HIGH`、`MEDIUM`、`LOW` |
| `priority` | `URGENT`、`HIGH`、`NORMAL`、`LOW` |
| `contentHash` | 规范化正文指纹 |
| `canonicalUrl` | 规范化 URL |
| `version` | 同一来源内容版本 |
| `supersedesId` | 上一版本，可空 |
| `reviewedById/reviewedAt/reviewNote` | 核验记录 |
| `createdAt/updatedAt` | 审计时间 |

索引：

- `canonicalUrl + version` 唯一；
- `contentHash`；
- `type + verificationStatus + publishedAt`；
- `validUntil`。

### 5.4 关联对象

为避免在 `SalesIntelligence` 中保存逗号字符串，使用关联表：

- `IntelligenceProduct(intelligenceId, productId)`
- `IntelligenceTherapeuticArea(intelligenceId, name)`
- `IntelligenceCompetitor(intelligenceId, competitorId)`

新增轻量 `CompetitorProduct`：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `name` | 竞品商品名 |
| `molecule` | 通用名 |
| `company` | 公司 |
| `therapeuticCategory` | 治疗领域 |
| `indications` | 演示版摘要 |
| `websiteUrl` | 官方入口，可空 |
| `active` | 是否关注 |

不在本期建设完整竞品主数据或市场份额模型。

### 5.5 使用记录

新增 `IntelligenceUsage`：

- `intelligenceId`
- `employeeId`
- `hcpId`、`productId`、`visitId`（均可空）
- `usageType`：`VIEWED`、`AGENT_CITED`、`VISIT_PREPARED`
- `usedAt`

本期只用于演示“哪些内容被用于准备”，不做复杂内容效果归因。

## 6. 采集与处理

### 6.1 调度

- 每日执行一次所有启用的白名单来源。
- 管理员可执行全量“立即采集”。
- 产品页或情报页可触发指定产品更新。
- Agent 在已采集内容不足时可请求一次搜索补充。

演示服务器使用独立 Node 命令执行采集；部署层通过 cron 或 PM2 cron 调度。Web 请求只创建/执行有上限的小任务，不承担无限时爬取。

### 6.2 采集适配器

统一接口：

```ts
interface IntelligenceCollector {
  collect(input: {
    source: IntelligenceSource;
    product?: Product;
    queryTerms: string[];
    limit: number;
  }): Promise<CollectedDocument[]>;
}
```

第一版提供：

- RSS/Atom 适配器；
- 通用列表页与详情页适配器；
- 搜索引擎适配器；
- 演示数据适配器，供自动化测试使用。

各来源的选择器、入口和查询词放在来源配置中。单个来源失败不阻断其他来源，任务状态记为 `PARTIAL`。

### 6.3 规范化与去重

处理顺序：

1. 规范化 URL，去除常见追踪参数；
2. 提取标题、发布时间、正文合理摘录；
3. 生成规范化文本的 SHA-256；
4. canonical URL 和内容指纹双重去重；
5. URL 相同但正文变化时创建新版本，并通过 `supersedesId` 关联；
6. 分类并提取产品、分子、治疗领域和竞品关键词；
7. 应用核验规则并落库。

### 6.4 自动核验

允许自动标记 `VERIFIED` 的条件：

- 来源为启用白名单；
- `trustLevel = AUTHORITATIVE`；
- URL 域名与来源配置一致；
- 标题、URL、摘录和采集时间完整；
- 内容类型在该来源允许范围内；
- 没有命中明显冲突或解析失败规则。

专业机构、企业官网和媒体内容默认进入 `PENDING_REVIEW`，管理员核验后才能成为已核验情报。搜索结果始终为 `PENDING_REVIEW`。

## 7. 检索与推荐规则

### 7.1 结构化相关性

优先按以下顺序匹配：

1. 指定产品或分子精确关联；
2. HCP 专科对应治疗领域；
3. 最近拜访讨论产品；
4. 代表负责产品/事业部；
5. 标题和摘要关键词。

排序综合：

- 核验状态；
- 优先级；
- 关联强度；
- 发布时间新鲜度；
- 来源可信级别。

默认不返回 `REJECTED` 或 `ARCHIVED`；已过有效期的政策只在明确查询历史时返回。

### 7.2 待核验内容

- CRM 页面可以展示，但必须有明显“待核验”标签。
- 拜访前简报默认折叠在“风险与待核验线索”中。
- Agent 不得把待核验内容作为无保留结论。
- Agent 可以说“发现一条尚未核验的线索”，并提供来源供用户判断。

## 8. API

### 8.1 情报管理

- `GET /api/sales-intelligence`
- `GET /api/sales-intelligence/[id]`
- `PATCH /api/sales-intelligence/[id]`
- `POST /api/sales-intelligence/[id]/review`
- `GET /api/intelligence-sources`
- `POST /api/intelligence-sources`
- `PATCH /api/intelligence-sources/[id]`

列表接口支持分页和第 4.1 节定义的筛选条件。

### 8.2 采集

- `POST /api/intelligence-collection/runs`
- `GET /api/intelligence-collection/runs`
- `GET /api/intelligence-collection/runs/[id]`

创建任务输入：

```json
{
  "triggerType": "MANUAL",
  "sourceId": null,
  "productId": null,
  "confirmed": true,
  "idempotencyKey": "stable-client-key"
}
```

产品刷新使用相同接口并传 `triggerType = PRODUCT_REFRESH` 和 `productId`。

### 8.3 场景化读取

- `GET /api/agent/sales-intelligence/search`
- `GET /api/agent/product-battlecard`
- 增强 `GET /api/agent/prepare-visit`
- 增强 `GET /api/agent/my-day`

所有 Agent 接口返回：

```json
{
  "items": [
    {
      "id": "...",
      "title": "...",
      "summary": "...",
      "sourceName": "...",
      "sourceUrl": "https://...",
      "publishedAt": "...",
      "collectedAt": "...",
      "verificationStatus": "VERIFIED",
      "confidence": "HIGH"
    }
  ]
}
```

## 9. MCP 工具

### 9.1 `search_sales_intelligence`

输入：

- `query`
- 可选 `types`
- 可选 `productId`
- 可选 `hcpId`
- 可选 `includePending`，默认 `false`
- `limit`，默认 10，最大 20

输出带来源的结果和检索条件摘要。员工身份只取 MCP session，不接受调用方覆盖。

### 9.2 `get_product_battlecard`

输入：

- `productId`
- 可选 `hcpId`
- 可选 `asOf`

输出：

- 产品和适用治疗领域；
- 已核验政策摘要；
- 已核验竞品动态；
- 疾病/产品知识要点；
- 基于已有内容生成的常见异议准备；
- 当前有效的批准材料；
- 引用来源列表；
- 明确的“内部参考/批准材料”边界。

### 9.3 `refresh_product_intelligence`

输入：

- `productId`
- `confirmed: true`
- `idempotencyKey`

行为：

- 创建一次 `PRODUCT_REFRESH` 采集；
- 同一身份、工具和 idempotency key 重试返回原结果；
- 写入现有最小 MCP 审计；
- 返回任务 ID 和状态，不承诺在单次 MCP 请求中等到全部互联网采集完成。

### 9.4 增强现有工具

`prepare_hcp_visit` 增加：

- `verifiedIntelligence`
- `pendingLeads`
- `suggestedQuestions`
- `approvedMaterials`
- `citations`

`get_my_day` 增加最多五条 `relevantIntelligence`。

## 10. Agent 输出规则

Agent 必须：

- 区分“已核验事实”“待核验线索”“建议动作”“批准材料”；
- 在关键事实附近展示来源；
- 优先使用有效且已核验的内容；
- 避免超出来源内容的疗效、比较优势或政策结论；
- 当来源冲突时并列展示，不自行裁决；
- 找不到依据时明确说明资料不足；
- 不生成诊断或治疗建议；
- 不把竞品新闻自动转成贬损性销售话术。

## 11. 演示数据与演示脚本

选择现有数据库中的一个重点 SKU、一个竞品和一个对应专科 HCP。

固定演示数据至少包括：

- 一条官方政策，自动核验；
- 一条竞品官网/药监动态，待人工核验后通过；
- 一条行业媒体新闻，保持待核验；
- 一条疾病知识；
- 一条产品知识；
- 两条现有已批准产品资料。

演示步骤：

1. 在“销售情报”查看上次每日采集结果。
2. 点击“立即采集”，展示新增、去重和失败统计。
3. 打开待核验竞品动态，核对来源并通过。
4. 打开代表首页，看到与负责产品相关的新情报。
5. 在 WorkBuddy 询问该产品最近政策与竞品变化。
6. Agent 调用 `search_sales_intelligence` 并给出带来源答案。
7. 让 Agent 为指定 HCP 准备拜访。
8. Agent 调用增强后的 `prepare_hcp_visit`，输出客户历史、知识要点、竞品准备和批准资料。
9. 让 Agent 生成产品应对卡，核对内部参考与批准材料的边界。
10. 在 CRM 完成拜访，保留原有资料使用和后续任务闭环。

## 12. 错误处理

- 单来源超时：记录失败并继续其他来源。
- 页面结构变化：该来源任务失败，不删除历史内容。
- 无发布时间：允许保存，但降低排序新鲜度，不允许该字段伪造。
- 重复内容：不新增情报，更新任务统计。
- 搜索服务不可用：返回已采集内容并说明补充搜索失败。
- Agent 触发采集超时：返回任务 ID，用户稍后查询状态。
- 来源 URL 不安全或非 HTTP(S)：拒绝保存。
- 内容解析为空：记录采集失败，不创建空情报。

## 13. 测试与验收

### 13.1 单元测试

- URL 规范化和内容指纹；
- 同 URL 新版本与跨 URL 同内容去重；
- 自动核验规则；
- 产品、治疗领域和竞品关联；
- 相关性排序；
- 待核验内容隔离；
- Agent 返回的来源和状态塑形；
- 采集幂等。

### 13.2 API/集成测试

- 来源与情报 CRUD；
- 核验状态流转；
- 采集任务成功、部分失败和重试；
- 指定产品刷新；
- 拜访前简报包含正确情报；
- 代表身份不能读取无关员工的个性化结果；
- MCP 写工具确认、身份、幂等和审计。

### 13.3 浏览器验收

- 销售情报菜单、筛选和详情可用；
- 待核验队列能够核验和驳回；
- 采集任务展示真实进度和统计；
- 代表首页、产品页和 HCP 页出现相关内容；
- 合规材料与普通情报视觉上可区分。

### 13.4 端到端验收

- 服务器每日调度命令可运行；
- 至少两个真实互联网白名单来源成功采集；
- 搜索补充能生成待核验记录；
- WorkBuddy 通过远程 MCP 完成检索、产品应对卡和拜访准备；
- 每个 Agent 关键结论均能追溯到 CRM 中的来源条目；
- 现有 CRM 与 MCP 回归测试保持通过。

## 14. 明确删减项

本期不实现：

- 任意网站的通用无限深度爬虫；
- 付费数据库、处方数据、市场份额和舆情采购；
- 自动绕过登录、验证码、反爬或付费墙；
- 全文新闻镜像和复杂版权管理；
- 向量数据库、知识图谱或独立 RAG 平台；
- 自动生成可对外使用的新宣传材料；
- 生产级 MLR 审批、电子签名和多级内容工作流；
- 多租户来源隔离；
- 复杂推荐模型或情报到销量的因果归因。

## 15. 实施顺序

1. 情报、来源、竞品和采集任务数据模型；
2. 采集领域规则、演示适配器和真实白名单适配器；
3. 情报管理与核验页面；
4. 产品、代表首页、HCP 和拜访简报嵌入；
5. 检索、产品应对卡和 MCP 工具；
6. 定时任务、部署配置、演示数据和端到端验证。

