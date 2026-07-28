"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { FollowUpTask, ListResponse } from "@/lib/types";
import { isTaskOverdue } from "@/lib/follow-up-task";
import { fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Notice, PageHeader, Select } from "@/components/ui";

export default function TasksPage() {
  const { current } = useUser();
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    apiGet<ListResponse<FollowUpTask>>("/api/tasks", { assigneeId: current.id, status: status || undefined })
      .then((res) => { setTasks(res.data); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [current, status]);

  useEffect(load, [load]);
  if (!current) return null;

  async function transition(task: FollowUpTask, next: "DONE" | "CANCELLED") {
    try {
      await apiPatch(`/api/tasks/${task.id}`, { status: next });
      setNotice(next === "DONE" ? "任务已完成" : "任务已取消");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
    }
  }

  async function createFollowUp(task: FollowUpTask) {
    try {
      await apiPost(`/api/tasks/${task.id}/follow-up-visit`);
      setNotice("复访草稿已创建，可在拜访记录中继续完善");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "创建复访失败");
    }
  }

  return (
    <div>
      <PageHeader
        title="后续任务"
        desc="把每次拜访承诺转成有截止日期、可完成的行动"
        extra={
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">待处理</option>
            <option value="DONE">已完成</option>
            <option value="CANCELLED">已取消</option>
            <option value="">全部</option>
          </Select>
        }
      />
      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载任务…" />}
      {!loading && !error && !tasks.length && <Card><Empty text="当前没有任务" /></Card>}
      {!loading && !error && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isTaskOverdue(task);
            return (
              <Card key={task.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{task.title}</span>
                      {task.priority === "HIGH" && <Badge tone="red">高优先级</Badge>}
                      {overdue && <Badge tone="red">已逾期</Badge>}
                      <Badge tone={task.status === "DONE" ? "emerald" : task.status === "CANCELLED" ? "slate" : "amber"}>
                        {task.status === "DONE" ? "已完成" : task.status === "CANCELLED" ? "已取消" : "待处理"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {task.hcp && <Link className="text-emerald-700 hover:underline" href={`/hcp/${task.hcp.id}`}>{task.hcp.name}</Link>}
                      {task.hco && <span>{task.hco.name}</span>}
                      {task.dueDate && <span>截止 {fmtDate(task.dueDate)}</span>}
                    </div>
                    {task.description && <div className="mt-2 text-sm text-slate-600">{task.description}</div>}
                  </div>
                  {task.status === "OPEN" && (
                    <div className="flex gap-2">
                      {!task.followUpVisitId && task.hcp && <Button size="sm" variant="outline" onClick={() => createFollowUp(task)}>创建复访</Button>}
                      <Button size="sm" onClick={() => transition(task, "DONE")}>完成</Button>
                      <Button size="sm" variant="ghost" onClick={() => transition(task, "CANCELLED")}>取消</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
