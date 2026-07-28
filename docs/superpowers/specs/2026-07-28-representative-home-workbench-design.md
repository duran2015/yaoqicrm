# 代表首页聚合工作台设计

## 目标

在现有仪表盘顶部为医药代表提供可直接行动的“今日安排、待跟进、推荐客户”，把周计划、任务、Cycle Plan 和 HCP 串成日常工作入口。

## 用户与日期

仅 `MR` 展示个人工作台；管理岗保持现有团队仪表盘。接口接受 `employeeId` 和可选 `asOf=YYYY-MM-DD`，演示首页传现有固定基准日。

## 聚合口径

### 今日安排

读取包含 `asOf` 的周计划中属于当天的项目，按计划时间升序返回最多 10 条。返回计划项目、状态、HCP、主要 HCO；未取消且未执行的项目提供 `/visits?planItemId=...` 开始拜访链接。

### 待跟进

读取分配给当前代表的 `OPEN` 任务，逾期优先，再按截止日期和优先级排序，最多 8 条。返回 HCP/HCO、截止日期、优先级，并提供任务中心和 `/api/tasks/[id]/follow-up-visit` 对应的页面操作入口。

### 推荐客户

读取当前月 Cycle Plan 项目并统计该代表当月已提交拜访。仅保留剩余缺口大于 0、且今日没有周计划安排的 HCP。排序为客户等级 A→B→C→D、剩余缺口倒序、最近拜访最早优先，最多 6 条。理由文案为“`A 级客户，本月还差 3 次覆盖`”。

没有当月 Cycle Plan 时推荐列表为空，并提示先建立月度覆盖计划，不发明另一套推荐算法。

## 接口

新增 `GET /api/representative/workbench?employeeId=&asOf=`。员工不存在返回 404，非 MR 返回 409。一次响应返回：

```ts
{
  asOf: string;
  todaySchedule: RepresentativeScheduleItem[];
  followUps: RepresentativeFollowUp[];
  recommendations: RepresentativeRecommendation[];
  recommendationEmptyReason: string | null;
}
```

纯领域函数负责优先级数值化、任务排序、推荐排序和理由生成。

## 界面

MR 首页在销售结果和 KPI 之前显示三栏工作台：

- 今日安排：时间、客户、机构、状态、开始拜访。
- 待跟进：逾期标识、标题、客户、截止日期、进入任务中心和发起复访。
- 推荐客户：等级、缺口、最近拜访、查看客户和加入周计划。

窄屏按三块纵向排列。空状态给出明确下一步，不新增全局导航。

## 验收

- MR 能看到三组仅属于自己的数据和快捷入口。
- 管理岗首页不展示个人工作台。
- 推荐排序、今日过滤和逾期任务排序可由纯函数测试重复验证。
- 不新增数据库表。
- 测试、lint、类型检查、构建和浏览器 MR/经理视图通过。
