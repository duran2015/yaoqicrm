# HCP 多任职 Lite 设计规格

## 目标

在不重构现有 HCP、拜访、会议和客户筛选流程的前提下，为演示版本补齐 HCP 多机构、多科室任职管理，并让原有 `Hcp.hcoId`、`Hcp.specialty`、`Hcp.title`、`Hcp.adminDuty` 始终反映当前主要任职。

## 范围

每条任职记录包含：

- 机构
- 科室名称
- 职称
- 行政职务
- 是否主要任职
- 生效日期
- 结束日期

HCP 详情页展示全部当前及历史任职，支持新增、编辑、设为主要和结束任职。演示数据覆盖单任职、多任职和历史任职。

本阶段不建设科室主数据、不实现执业证照审批、不改造拜访和会议的历史机构快照、不支持删除任职记录。

## 数据模型

新增 `HcpAffiliation`：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `id` | String | cuid 主键 |
| `hcpId` | String | 必填，关联 HCP，级联删除 |
| `hcoId` | String | 必填，关联 HCO，限制删除 |
| `departmentName` | String | 必填，去除首尾空格 |
| `title` | String? | 可选 |
| `adminDuty` | String? | 可选 |
| `isPrimary` | Boolean | 默认 false |
| `effectiveDate` | DateTime | 必填，按上海时区业务日解析 |
| `endDate` | DateTime? | 必须晚于生效日期 |
| `createdAt` | DateTime | 自动生成 |
| `updatedAt` | DateTime | 自动更新 |

当前任职定义为 `effectiveDate <= asOf` 且 `endDate` 为空或 `endDate > asOf`，采用左闭右开区间。

SQLite 不支持适用本场景的部分唯一索引，因此“同一 HCP 只能有一条当前主要任职”由服务事务保证；所有写入只能经过任职服务。

## 业务规则

1. 新增 HCP 第一条当前任职时自动成为主要任职。
2. 只有当前任职可以设为主要任职；未来或历史任职不能设为主要。
3. 设置主要任职时，在同一事务内取消该 HCP 其他任职的主要标记。
4. 结束当前主要任职时，自动将其他当前任职中生效日期最近的一条设为主要；没有候选时清空兼容字段。
5. 将主要任职编辑为未来或历史区间时，按结束主要任职的规则选择替代项。
6. 同一 HCP 不允许存在机构、科室和生效日期都相同的重复记录。
7. 每次主要任职变化后同步：
   - `Hcp.hcoId = affiliation.hcoId`
   - `Hcp.specialty = affiliation.departmentName`
   - `Hcp.title = affiliation.title`
   - `Hcp.adminDuty = affiliation.adminDuty`
8. 没有当前主要任职时，上述四个兼容字段全部清空。
9. 任职接口以当前服务器时间判断“当前”；领域函数接受 `asOf` 参数，以便稳定测试。

## 接口

### `GET /api/hcp/[id]/affiliations`

返回任职列表，主要任职优先，其余按生效日期倒序；每条包含 HCO 基础信息和计算字段 `isCurrent`。

### `POST /api/hcp/[id]/affiliations`

请求字段为 `hcoId`、`departmentName`、`title`、`adminDuty`、`isPrimary`、`effectiveDate`、`endDate`。校验 HCP/HCO、日期和重复记录后事务写入并同步兼容字段。

### `PATCH /api/hcp/[id]/affiliations/[affiliationId]`

整体提交上述可编辑字段，用于编辑、设为主要和结束任职。接口校验任职属于路径中的 HCP。

HCP 360 的 `GET /api/hcp/[id]` 同时包含 `affiliations`，页面无需额外首屏请求。

## 界面

HCP 详情“工作信息”之前新增“任职经历”卡片：

- 标题区显示“新增任职”。
- 当前主要任职显示绿色“主要任职”标记，其他当前任职显示“当前任职”，历史和未来分别显示状态。
- 每条展示机构、科室、职称、行政职务及有效期。
- 操作包含编辑、设为主要和结束任职；历史任职只允许编辑。
- 新增/编辑使用轻量内嵌表单；结束操作将结束日期设为当天。
- 成功后刷新完整 HCP 详情，立即体现头部和兼容字段变化。

## 数据迁移与演示数据

迁移新增表后，为现有每个具备 `hcoId` 的 HCP 建立一条主要任职，科室/职称/行政职务来自兼容字段，生效日期使用 `2025-01-01`。

种子数据额外将至少一个 HCP 配置为两条当前任职，将至少一个 HCP 配置为一条历史任职加一条当前主要任职。

## 验收条件

- 同一 HCP 经任意接口操作后最多只有一条当前主要任职。
- 切换或结束主要任职后，HCP 头部、列表及原有关联流程读取到同步后的机构、科室、职称和行政职务。
- 日期区间、HCP/HCO 存在性及重复任职校验产生明确错误。
- HCP 详情可完成新增、编辑、设为主要、结束和查看历史的演示闭环。
- 单元测试、ESLint、Prisma 校验、生产构建和浏览器关键流程全部通过。
