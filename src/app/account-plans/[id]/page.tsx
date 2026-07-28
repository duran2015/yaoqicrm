"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { AccountMilestone, AccountPlan } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, TierBadge } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = { DECISION_MAKER: "决策者", INFLUENCER: "影响者", SUPPORTER: "支持者" };
const ATTITUDE_LABELS: Record<string, string> = { ADVOCATE: "强力支持", SUPPORTIVE: "支持", NEUTRAL: "中立", OPPOSED: "反对" };

export default function AccountPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { employees } = useUser();
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("2026-08-15");

  const load = useCallback(() => {
    setLoading(true);
    apiGet<AccountPlan>(`/api/account-plans/${id}`)
      .then((response) => { setPlan(response); setError(null); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    try { await action(); setNotice(success); load(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "操作失败"); }
  }

  async function createMilestone() {
    if (!plan) return;
    await run(() => apiPost(`/api/account-plans/${plan.id}/milestones`, { title, ownerId, dueDate }), "里程碑已创建");
    setDialogOpen(false);
  }

  function transition(milestone: AccountMilestone, status: "DONE" | "CANCELLED") {
    return run(() => apiPatch(`/api/account-plans/milestones/${milestone.id}`, { status }), status === "DONE" ? "里程碑已完成" : "里程碑已取消");
  }

  async function closePlan() {
    if (!plan || !window.confirm(`确认关闭该计划？当前仍有 ${plan.milestones.filter((item) => item.status === "OPEN").length} 个开放里程碑。`)) return;
    await run(() => apiPost(`/api/account-plans/${plan.id}/close`), "Account Plan 已关闭");
  }

  if (loading) return <Loading text="正在加载客户策略…" />;
  if (error && !plan) return <ErrorBox message={error} onRetry={load} />;
  if (!plan) return <Empty text="Account Plan 不存在" />;

  return (
    <div>
      <div className="mb-3 text-sm text-slate-400"><Link href="/account-plans" className="hover:text-emerald-600">客户策略</Link><span className="mx-1.5">/</span>{plan.hco.name}</div>
      <PageHeader title={`${plan.hco.name} Account Plan`} desc={`${plan.year} · 负责人 ${plan.owner.name}`} extra={plan.status === "ACTIVE" ? <div className="flex gap-2"><Button variant="outline" onClick={() => { setOwnerId(plan.owner.id); setDialogOpen(true); }}>新增里程碑</Button><Button variant="danger" onClick={closePlan}>关闭计划</Button></div> : <Badge tone="slate">已关闭</Badge>} />
      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}

      <div className="mb-5 grid gap-3 md:grid-cols-6">
        {[
          ["里程碑进度", `${Math.round(plan.progress.progress * 100)}%`],
          ["已完成", `${plan.progress.completed}/${plan.progress.total}`],
          ["逾期", plan.progress.overdue],
          ["决策人未覆盖", plan.uncoveredDecisionMakers],
          ["年度拜访", plan.activity?.visitCount ?? 0],
          ["开放任务", plan.activity?.openTasks.length ?? 0],
        ].map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold text-slate-900">{value}</div></Card>)}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">客户策略</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="text-xs text-slate-400">业务目标</div><div className="mt-1 text-sm text-slate-700">{plan.businessGoal}</div></div>
            <div><div className="text-xs text-slate-400">现状判断</div><div className="mt-1 text-sm text-slate-700">{plan.situation ?? "暂无"}</div></div>
            <div><div className="text-xs text-slate-400">核心策略</div><div className="mt-1 text-sm text-slate-700">{plan.strategy}</div></div>
            <div><div className="text-xs text-slate-400">成功标准</div><div className="mt-1 text-sm text-slate-700">{plan.successCriteria}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{plan.products.map((item) => <Badge key={item.id} tone="blue">{item.product.brand} · {item.product.molecule}</Badge>)}</div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">关键关系人</div>
          {!plan.stakeholders.length ? <Empty text="暂无关键关系人" /> : <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 text-left">HCP</th><th className="px-4 py-3 text-left">角色</th><th className="px-4 py-3 text-left">态度</th><th className="px-4 py-3 text-left">最近覆盖</th></tr></thead><tbody className="divide-y divide-slate-100">{plan.stakeholders.map((item) => <tr key={item.id}><td className="px-5 py-3"><span className="font-medium">{item.hcp.name}</span><span className="ml-2 text-xs text-slate-400">{item.hcp.title}</span>{item.hcp.tier && <TierBadge tier={item.hcp.tier} />}</td><td className="px-4 py-3">{ROLE_LABELS[item.decisionRole] ?? item.decisionRole}</td><td className="px-4 py-3"><Badge tone={item.attitude === "OPPOSED" ? "red" : item.attitude === "NEUTRAL" ? "amber" : "emerald"}>{ATTITUDE_LABELS[item.attitude] ?? item.attitude}</Badge></td><td className="px-4 py-3">{item.lastVisitDate ? fmtDate(item.lastVisitDate) : item.decisionRole === "DECISION_MAKER" ? <Badge tone="red">未覆盖</Badge> : "—"}</td></tr>)}</tbody></table>}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700">执行里程碑</h2>{plan.status === "ACTIVE" && <Button size="sm" onClick={() => { setOwnerId(plan.owner.id); setDialogOpen(true); }}>新增里程碑</Button>}</div>
          {!plan.milestones.length ? <Empty text="暂无里程碑" /> : <div className="space-y-3">{plan.milestones.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><div className="text-sm font-medium text-slate-800">{item.title}</div><div className="mt-1 text-xs text-slate-400">{item.owner.name} · 截止 {fmtDate(item.dueDate)}{item.followUpTask ? ` · 任务：${item.followUpTask.status === "DONE" ? "已完成" : "进行中"}` : ""}</div></div><div className="flex items-center gap-2"><Badge tone={item.status === "DONE" ? "emerald" : item.status === "CANCELLED" ? "slate" : new Date(item.dueDate) < new Date() ? "red" : "amber"}>{item.status === "DONE" ? "已完成" : item.status === "CANCELLED" ? "已取消" : "进行中"}</Badge>{plan.status === "ACTIVE" && item.status === "OPEN" && !item.followUpTask && <Button size="sm" variant="outline" onClick={() => run(() => apiPost(`/api/account-plans/milestones/${item.id}/task`), "后续任务已创建")}>转为任务</Button>}{plan.status === "ACTIVE" && item.status === "OPEN" && <><Button size="sm" onClick={() => transition(item, "DONE")}>完成</Button><Button size="sm" variant="ghost" onClick={() => transition(item, "CANCELLED")}>取消</Button></>}</div></div>)}</div>}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><h2 className="mb-3 text-sm font-semibold text-slate-700">最近拜访</h2>{!plan.activity?.recentVisits.length ? <Empty text="暂无拜访" /> : <div className="space-y-2">{plan.activity.recentVisits.slice(0, 8).map((visit) => <div key={visit.id} className="text-sm text-slate-600">{fmtDate(visit.visitDate)} · {visit.employee.name} · {visit.hcp?.name ?? "机构拜访"}</div>)}</div>}</Card>
          <Card className="p-5"><h2 className="mb-3 text-sm font-semibold text-slate-700">会议与任务</h2><div className="text-sm text-slate-600">关联会议 {plan.activity?.meetings.length ?? 0} 场 · 开放任务 {plan.activity?.openTasks.length ?? 0} 个</div><div className="mt-3 space-y-2">{plan.activity?.openTasks.slice(0, 6).map((task) => <div key={task.id} className="text-xs text-slate-500">{task.title} · {task.assignee.name}{task.dueDate ? ` · ${fmtDate(task.dueDate)}` : ""}</div>)}</div></Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="新增里程碑">
        <div className="space-y-4"><Field label="标题" required><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="负责人" required><Select className="w-full" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</Select></Field><Field label="截止日期" required><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button><Button disabled={!title || !ownerId || !dueDate} onClick={createMilestone}>创建</Button></div></div>
      </Dialog>
    </div>
  );
}
