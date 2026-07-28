"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import type { RepresentativeWorkbenchData } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Loading } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { VisitFormDialog } from "@/components/visit-form";

type ScheduleItem = RepresentativeWorkbenchData["todaySchedule"][number];

export function RepresentativeWorkbench({ employeeId, asOf }: { employeeId: string; asOf: string }) {
  const [data, setData] = useState<RepresentativeWorkbenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitItem, setVisitItem] = useState<ScheduleItem | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<RepresentativeWorkbenchData>("/api/representative/workbench", { employeeId, asOf })
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "代表工作台加载失败"))
      .finally(() => setLoading(false));
  }, [employeeId, asOf]);

  useEffect(load, [load]);

  async function createFollowUpVisit(taskId: string) {
    setBusyTaskId(taskId);
    setError(null);
    try {
      await apiPost(`/api/tasks/${taskId}/follow-up-visit`);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建复访失败");
    } finally {
      setBusyTaskId(null);
    }
  }

  if (loading) return <Card><Loading text="正在聚合今日工作…" /></Card>;
  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return null;

  const asOfStart = new Date(data.asOf);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">我的今日工作台</h2>
          <p className="mt-0.5 text-xs text-slate-500">从安排、跟进到客户覆盖，直接进入下一步行动</p>
        </div>
        <Link href="/tour-plans" className="text-xs text-emerald-700 hover:underline">管理周计划 →</Link>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-medium text-slate-700">今日安排</h3></div>
          {!data.todaySchedule.length ? <Empty text="今天暂无计划，可从周计划添加" /> : (
            <div className="divide-y divide-slate-100">
              {data.todaySchedule.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{item.hcp?.name ?? item.hcoName ?? "机构拜访"}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.hcp?.hco?.name ?? item.hcoName ?? "未关联机构"} · {fmtDateTime(item.planDate)}</div>
                    </div>
                    <Badge tone={item.status === "COMPLETED" ? "emerald" : item.status === "CANCELLED" ? "slate" : "amber"}>
                      {item.status === "COMPLETED" ? "已完成" : item.status === "CANCELLED" ? "已取消" : "待拜访"}
                    </Badge>
                  </div>
                  {item.note && <div className="mt-2 text-xs text-slate-500">{item.note}</div>}
                  {item.status === "PLANNED" && item.hcp && <Button className="mt-3" size="sm" onClick={() => setVisitItem(item)}>开始拜访</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-700">待跟进</h3>
            <Link href="/tasks" className="text-xs text-emerald-700 hover:underline">全部任务</Link>
          </div>
          {!data.followUps.length ? <Empty text="当前没有开放任务" /> : (
            <div className="divide-y divide-slate-100">
              {data.followUps.slice(0, 5).map((task) => {
                const overdue = task.dueDate ? new Date(task.dueDate) < asOfStart : false;
                return (
                  <div key={task.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{task.title}</span>
                      {overdue && <Badge tone="red">已逾期</Badge>}
                      {task.priority === "HIGH" && <Badge tone="amber">高优先级</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {task.hcp?.name ?? task.hco?.name ?? "未关联客户"}{task.dueDate ? ` · 截止 ${fmtDate(task.dueDate)}` : " · 未设截止日期"}
                    </div>
                    {task.hcp && !task.followUpVisitId && (
                      <Button className="mt-3" size="sm" variant="outline" disabled={busyTaskId === task.id} onClick={() => createFollowUpVisit(task.id)}>
                        {busyTaskId === task.id ? "创建中…" : "创建复访"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-700">推荐客户</h3>
            <Link href="/cycle-plans" className="text-xs text-emerald-700 hover:underline">月度覆盖</Link>
          </div>
          {!data.recommendations.length ? <Empty text={data.recommendationEmptyReason ?? "本月客户覆盖已达标"} /> : (
            <div className="divide-y divide-slate-100">
              {data.recommendations.slice(0, 5).map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/hcp/${item.hcp.id}`} className="text-sm font-medium text-slate-800 hover:text-emerald-700">{item.hcp.name}</Link>
                    <Badge tone={item.tier === "A" ? "red" : item.tier === "B" ? "blue" : "slate"}>{item.tier} 级</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.hcp.hco?.name ?? "未关联机构"}</div>
                  <div className="mt-2 text-xs font-medium text-amber-700">{item.reason}</div>
                  <div className="mt-1 text-xs text-slate-400">最近覆盖：{item.lastVisitDate ? fmtDate(item.lastVisitDate) : "本月尚未拜访"}</div>
                  <Link href={`/tour-plans?hcpId=${encodeURIComponent(item.hcp.id)}`}><Button className="mt-3" size="sm" variant="outline">加入周计划</Button></Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <VisitFormDialog
        open={Boolean(visitItem)}
        onClose={() => setVisitItem(null)}
        preselectedHcp={visitItem?.hcp ? { id: visitItem.hcp.id, name: visitItem.hcp.name } : null}
        tourPlanItemId={visitItem?.id}
        plannedDate={visitItem?.planDate}
        onSuccess={() => { setVisitItem(null); load(); }}
      />
    </section>
  );
}
