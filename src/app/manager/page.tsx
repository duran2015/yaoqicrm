"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { CoachingAction } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Textarea } from "@/components/ui";

interface Workbench {
  counts: Record<string, number>;
  pendingPlans: Array<{ id: string; weekStart: string; employee: { id: string; name: string }; items: unknown[] }>;
  pendingEvaluations: Array<{ id: string; visitDate: string; employee: { id: string; name: string }; hcp?: { name: string } | null }>;
  checkinExceptions: Array<{ id: string; checkinTime: string; employee: { id: string; name: string }; visit: { id: string; hcp?: { name: string } | null } }>;
  overdueTasks: Array<{ id: string; title: string; dueDate: string; assignee: { id: string; name: string }; hcp?: { name: string } | null }>;
  coachingActions: CoachingAction[];
  employees: Array<{ id: string; name: string; role: string }>;
}

export default function ManagerPage() {
  const { current } = useUser();
  const [data, setData] = useState<Workbench | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [sourceVisitId, setSourceVisitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    apiGet<Workbench>("/api/manager/workbench", { managerId: current.id })
      .then((res) => { setData(res); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [current]);
  useEffect(load, [load]);
  if (!current) return null;

  function openCoaching(employee: { id: string }, visitId?: string) {
    setEmployeeId(employee.id);
    setSourceVisitId(visitId ?? "");
    setTitle("拜访质量辅导");
    setDescription("");
    setDueDate("");
    setDialogOpen(true);
  }

  async function createCoaching() {
    if (!current) return;
    try {
      await apiPost("/api/coaching-actions", {
        managerId: current.id, employeeId, sourceVisitId: sourceVisitId || undefined,
        title, description: description || undefined, dueDate: dueDate || undefined,
      });
      setDialogOpen(false);
      setNotice("辅导行动已创建");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "创建失败");
    }
  }

  async function complete(action: CoachingAction) {
    try {
      await apiPatch(`/api/coaching-actions/${action.id}`, { status: "DONE" });
      setNotice("辅导行动已完成");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  }

  const cards = data ? [
    ["待批计划", data.counts.pendingPlans, "/tour-plans"],
    ["待评拜访", data.counts.pendingEvaluations, "/evaluations"],
    ["异常签到", data.counts.checkinExceptions, "#exceptions"],
    ["逾期任务", data.counts.overdueTasks, "#tasks"],
    ["待办辅导", data.counts.openCoachings, "#coachings"],
  ] as const : [];

  return (
    <div>
      <PageHeader title="经理工作台" desc="从异常发现到辅导完成的一站式管理视图" />
      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在汇总团队待办…" />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-5">
            {cards.map(([label, count, href]) => (
              <a key={label} href={href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{count}</div>
              </a>
            ))}
          </div>

          <section id="exceptions">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">异常签到</h2>
            {!data.checkinExceptions.length ? <Card><Empty text="暂无异常签到" /></Card> : (
              <div className="space-y-2">
                {data.checkinExceptions.map((item) => (
                  <Card key={item.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">{item.employee.name}</span> · {item.visit.hcp?.name ?? "机构拜访"} · {fmtDate(item.checkinTime)}
                      <Badge tone="red" className="ml-2">地点异常</Badge>
                    </div>
                    <Button size="sm" onClick={() => openCoaching(item.employee, item.visit.id)}>创建辅导</Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section id="tasks">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">下属逾期任务</h2>
            {!data.overdueTasks.length ? <Card><Empty text="暂无逾期任务" /></Card> : (
              <div className="space-y-2">
                {data.overdueTasks.map((task) => (
                  <Card key={task.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="text-sm"><span className="font-medium">{task.assignee.name}</span> · {task.title} · 截止 {fmtDate(task.dueDate)}</div>
                    <Button size="sm" variant="outline" onClick={() => openCoaching(task.assignee)}>创建辅导</Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section id="coachings">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">辅导行动</h2>
              <Button size="sm" onClick={() => openCoaching(data.employees[0] ?? { id: "" })}>新建辅导</Button>
            </div>
            {!data.coachingActions.length ? <Card><Empty text="暂无辅导行动" /></Card> : (
              <div className="space-y-2">
                {data.coachingActions.map((action) => (
                  <Card key={action.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{action.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{action.employee.name}{action.dueDate ? ` · 截止 ${fmtDate(action.dueDate)}` : ""}</div>
                    </div>
                    {action.status === "OPEN" ? <Button size="sm" onClick={() => complete(action)}>标记完成</Button> : <Badge tone="emerald">已完成</Badge>}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="text-right text-xs text-slate-400">
            计划审批和拜访评定继续使用原页面：<Link href="/tour-plans" className="text-emerald-700">周计划</Link> · <Link href="/evaluations" className="text-emerald-700">拜访评定</Link>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="创建辅导行动">
        <div className="space-y-4">
          <Field label="被辅导员工" required>
            <Select className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">请选择员工</option>
              {data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}
            </Select>
          </Field>
          <Field label="行动标题" required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="具体要求"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="截止日期"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button><Button disabled={!employeeId || !title} onClick={createCoaching}>创建</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
