# Pharma CRM P0 销售闭环设计

日期：2026-07-28  
状态：已确认

## 目标

保留现有 Next.js、SQLite 和界面风格，补齐五个 P0 产品包的创建、流转、状态、关联关系及演示数据，使系统能连续演示：

> 周计划 → 拜访准备 → 拜访执行 → 后续任务/复访 → 经理管理，同时覆盖样品与会议跟进。

本阶段面向产品演示，不建设移动离线、法规规则引擎、认证电子签名、通用工作流引擎或生产级身份权限。

## 设计原则

1. 增量扩展现有页面和 API，不重做导航或设计系统。
2. 所有操作写入 SQLite 并产生可查询的状态变化，不创建静态假页面。
3. 计划、拜访、任务、样品、会议和辅导通过数据库 ID 关联。
4. 共享的任务、状态和统计逻辑只实现一套，避免页面各自维护副本。
5. API 保持现有风格，所有状态流转在服务端校验。

## 领域模型

### 周计划与拜访

`TourPlanItem` 新增：

- `status`: `PLANNED | COMPLETED | CANCELLED`，默认 `PLANNED`。
- `visitId`: 可空且唯一，关联由该计划项创建的拜访。

`Visit` 新增：

- `status`: `DRAFT | SUBMITTED`，默认 `SUBMITTED`，兼容现有数据。
- 与 `TourPlanItem` 的可空一对一反向关联。

计划项只允许在计划为 `APPROVED` 时转拜访。创建拜访后建立关联；提交拜访时把计划项标为 `COMPLETED`。取消计划项后不能转拜访。

### 后续任务

新增 `FollowUpTask`：

- `id`
- `title`
- `description?`
- `status`: `OPEN | DONE | CANCELLED`
- `priority`: `NORMAL | HIGH`
- `dueDate?`
- `assigneeId`
- `hcpId?`
- `hcoId?`
- `sourceVisitId?`
- `sourceEventId?`
- `followUpVisitId?`
- `completedAt?`
- `createdAt`
- `updatedAt`

任务至少关联一个 HCP 或 HCO。来源拜访和来源会议均可为空，但通过界面创建的任务必须记录来源或明确标识为手工任务。完成任务记录完成时间；取消任务不可再次完成。任务可创建一次复访，并记录 `followUpVisitId`。

### 样品

沿用 `SampleTransaction`，将类型扩展为：

- `RECEIVE`: 代表领用，增加库存。
- `DISTRIBUTE`: 拜访发放，减少库存。
- `RETURN`: 代表退回，减少库存。
- `ADJUST`: 盘点调整，可正可负。

新增：

- `reason?`
- `confirmedByHcp`: Boolean，默认 `false`。
- `createdAt`

库存计算规则为：

`RECEIVE - DISTRIBUTE - RETURN + ADJUST`

发放必须关联 HCP；演示签收使用 `confirmedByHcp`，不模拟具有法律效力的电子签名。任何减少库存的事务均不得使批次库存为负。

### 会议

`MedEvent` 新增 `status`: `DRAFT | OPEN | COMPLETED | CANCELLED`。

`EventAttendance` 新增：

- `status`: `INVITED | CHECKED_IN | ABSENT`
- `checkedInAt?`

会议可创建并邀请 HCP；`OPEN` 状态可签到；`COMPLETED` 后可选择参会人批量生成 `FollowUpTask`。重复执行批量跟进时，不为同一会议、HCP 和标题创建重复未完成任务。

### 经理辅导

新增 `CoachingAction`：

- `id`
- `title`
- `description?`
- `status`: `OPEN | DONE | CANCELLED`
- `managerId`
- `employeeId`
- `sourceVisitId?`
- `dueDate?`
- `completedAt?`
- `createdAt`
- `updatedAt`

辅导行动由经理创建，必须关联一名代表，可选关联拜访。代表可完成行动；经理工作台显示未完成和近期已完成行动。

## 产品流程

### 1. 周计划、日历和计划转拜访

- “我的本周计划”空状态提供创建按钮。
- 代表可选择一周、添加多条日期/HCP/机构/备注，保存草稿并编辑。
- 草稿或驳回计划可提交；提交后不可编辑；经理可批准或驳回。
- 周日历按日期展示批准计划项及状态。
- 批准且未执行的计划项提供“记录拜访”，预填客户、日期和目的。
- 拜访提交后日历显示已完成并链接拜访详情。

### 2. 拜访前简报、任务和复访

- 从计划项或 HCP 详情进入拜访时展示拜访前简报。
- 简报包括客户基本信息、分级、最近拜访、上次结果/后续行动、产品反馈、样品历史和未完成任务。
- 拜访可保存草稿或提交。
- 提交时可把后续行动创建为结构化任务，指定截止日期和优先级。
- 任务中心支持筛选、完成、取消和创建复访。
- 复访预填客户，并回链原任务。

### 3. 经理工作台

- 集中展示待审批周计划、待评定拜访、异常签到、下属超期任务和辅导行动。
- 每类待办可进入原业务详情，不复制审批或评定逻辑。
- 经理可从异常签到或拜访评定创建辅导行动。
- 支持按代表查看待办数量与行动完成情况。

### 4. 样品最小闭环

- 库存页保留产品/批次汇总，并新增流水。
- 支持领用、退回和盘点调整。
- 拜访发放继续在拜访表单完成，增加签收确认。
- 操作表单显示操作后的预计库存；库存不足时服务端拒绝。
- 流水展示类型、批次、数量、对象、原因、时间及关联拜访。

### 5. 会议创建、签到和会后跟进

- 会议列表新增创建入口。
- 创建会议时填写名称、类型、日期、地点、预算并选择 HCP。
- 会议详情可开始会议、对受邀 HCP 签到或标记缺席、结束会议。
- 会议结束后可选择已签到 HCP，填写统一任务标题和截止日期，批量生成跟进任务。
- HCP 360 继续展示参会记录，并可看到相应未完成任务。

## 页面与导航

保留现有视觉体系，新增：

- `/tasks`: 代表后续任务。
- `/manager`: 经理工作台。

扩展：

- `/tour-plans`: 编辑器和周日历。
- `/visits`: 简报、草稿/提交、任务生成和计划关联。
- `/samples`: 库存操作和流水。
- `/events`: 创建、签到、结束和批量跟进。
- `/hcp/[id]`: 未完成任务及计划拜访入口。

导航仅为代表增加“后续任务”，为经理增加“经理工作台”；不新增重复的业务菜单。

## API 边界

新增或扩展以下接口：

- `POST /api/tour-plans`
- `PATCH /api/tour-plans/[id]`
- `POST /api/tour-plans/items/[id]/cancel`
- `GET /api/visit-brief?hcpId=&employeeId=`
- `POST /api/visits` 支持 `status`、`tourPlanItemId` 和任务字段
- `PATCH /api/visits/[id]` 支持提交草稿
- `GET|POST /api/tasks`
- `PATCH /api/tasks/[id]`
- `POST /api/tasks/[id]/follow-up-visit`
- `GET|POST /api/samples/transactions`
- `GET /api/manager/workbench`
- `GET|POST /api/coaching-actions`
- `PATCH /api/coaching-actions/[id]`
- `POST /api/events`
- `PATCH /api/events/[id]`
- `PATCH /api/events/[id]/attendees/[attendanceId]`
- `POST /api/events/[id]/follow-up-tasks`

错误统一使用现有 `err()` 返回明确中文消息。无效状态转换返回 HTTP 409；参数错误返回 400；对象不存在返回 404。

## 演示数据

种子数据至少包含：

- 一份待提交计划、一份待审批计划和一份已批准且部分完成的计划。
- 一次带产品反馈和样品发放的历史拜访。
- 一条逾期任务、一条即将到期任务和一条已完成任务。
- 每种样品事务至少一条，库存结果保持非负。
- 一场进行中会议和一场已结束但待跟进会议。
- 一条未完成和一条已完成的辅导行动。

重复执行 seed 后数据应被重建为同一套确定性演示场景。

## 错误与一致性

- 计划转拜访、拜访提交及计划项完成在事务内执行。
- 样品库存校验与事务创建在同一事务内执行。
- 批量会议跟进在事务内创建，并防止重复未完成任务。
- 删除不属于本阶段；使用 `CANCELLED` 保留演示历史。
- 前端操作失败后保留表单输入并显示服务端错误。
- 所有空状态提供下一步操作或明确说明。

## 测试与验收

使用 Node 内置测试运行器配合 `tsx --test` 测试纯领域规则；API 和 Prisma 集成测试使用独立 SQLite 测试库。页面以构建、浏览器关键路径和现有页面回归验证。

必须通过以下端到端验收：

1. 代表创建周计划，经理批准，代表从计划项提交拜访，计划项变为完成。
2. 拜访提交生成任务，任务创建复访并完成。
3. 经理发现异常，创建辅导行动，代表完成后经理工作台更新。
4. 代表领用样品、拜访发放、退回并盘点，库存和流水一致且不出现负数。
5. 创建会议、邀请并签到 HCP、结束会议、批量生成跟进任务。
6. 执行 seed、测试、lint、build 后无错误。

## 非目标

- 不实现移动离线、地图路线优化或拖拽日历。
- 不实现正式电子签名或完整样品法规规则。
- 不实现费用报销、合规邮件、远程拜访。
- 不实现 Cycle Plan、Account Plan、销量导入或 WorkBuddy/MCP 串联；这些在五个 P0 完成后单独设计。
- 不在本阶段迁移 PostgreSQL 或建设 SSO/RBAC。
