"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { isManagerRole, PLAN_STATUS_LABELS, WEEK_START_ISO, WEEK_START_LABEL } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { ListResponse, TourPlan } from "@/lib/types";
import { fmtDate, fmtWeekday } from "@/lib/utils";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Notice, PageHeader, TierBadge } from "@/components/ui";
import { TourPlanEditor } from "@/components/tour-plan-editor";
import { VisitFormDialog } from "@/components/visit-form";
import { businessDateKey, canEditPlan, canStartPlanItem } from "@/lib/tour-plan";

const STATUS_TONES: Record<string, "slate" | "amber" | "emerald" | "red"> = {
  DRAFT: "slate",
  SUBMITTED: "amber",
  APPROVED: "emerald",
  REJECTED: "red",
};

function PlanCard({
  plan,
  actions,
  onStartVisit,
}: {
  plan: TourPlan;
  actions?: React.ReactNode;
  onStartVisit?: (item: TourPlan["items"][number]) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{plan.employee.name}</span>
          <span className="text-xs text-slate-400">{plan.employee.division}</span>
          <Badge tone={STATUS_TONES[plan.status] ?? "slate"}>{PLAN_STATUS_LABELS[plan.status] ?? plan.status}</Badge>
        </div>
        {actions}
      </div>
      {plan.status === "REJECTED" && plan.rejectReason && (
        <div className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          驳回原因:{plan.rejectReason}
        </div>
      )}
      {plan.items.length === 0 ? (
        <div className="text-xs text-slate-400">计划内暂无条目</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {plan.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-slate-500">
                  {fmtDate(item.planDate)} {fmtWeekday(item.planDate)}
                </span>
                {item.hcp ? (
                  <span className="text-slate-700">
                    {item.hcp.name}
                    <span className="ml-1 text-xs text-slate-400">{item.hcp.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{item.hcp.hco?.name}</span>
                  </span>
                ) : (
                  <span className="text-slate-700">{item.hcoName ?? "未指定对象"}</span>
                )}
                {item.hcp?.tier && <TierBadge tier={item.hcp.tier} />}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={item.status === "COMPLETED" ? "emerald" : item.status === "CANCELLED" ? "red" : "slate"}>
                  {item.status === "COMPLETED" ? "已完成" : item.status === "CANCELLED" ? "已取消" : "待执行"}
                </Badge>
                {item.note && <span className="text-xs text-slate-400">{item.note}</span>}
                {onStartVisit && canStartPlanItem(plan.status, item.status, item.visitId) && (
                  <Button size="sm" onClick={() => onStartVisit(item)}>记录拜访</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function TourPlansPage() {
  const { current, subtreeIds } = useUser();
  const [myPlans, setMyPlans] = useState<TourPlan[]>([]);
  const [pendingPlans, setPendingPlans] = useState<TourPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TourPlan | null>(null);
  const [visitItem, setVisitItem] = useState<TourPlan["items"][number] | null>(null);
  const [initialHcpId, setInitialHcpId] = useState("");

  const manager = isManagerRole(current?.role);
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(WEEK_START_ISO);
    date.setDate(date.getDate() + offset);
    return date;
  });

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    setError(null);
    const requests: Promise<void>[] = [
      apiGet<ListResponse<TourPlan>>("/api/tour-plans", { employeeId: current.id, weekStart: WEEK_START_ISO })
        .then((res) => setMyPlans(res.data))
        .catch((e: unknown) => {
          throw e;
        }),
    ];
    if (isManagerRole(current.role)) {
      requests.push(
        apiGet<ListResponse<TourPlan>>("/api/tour-plans", { status: "SUBMITTED", weekStart: WEEK_START_ISO })
          .then((res) => {
            // 只保留我下属提交的计划
            setPendingPlans(res.data.filter((p) => subtreeIds.has(p.employee.id) && p.employee.id !== current.id));
          })
          .catch(() => setPendingPlans([]))
      );
    }
    Promise.all(requests)
      .then(() => setLoading(false))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current, subtreeIds]);

  useEffect(load, [load]);
  useEffect(() => {
    const hcpId = new URLSearchParams(window.location.search).get("hcpId");
    if (hcpId) {
      setInitialHcpId(hcpId);
      setEditingPlan(null);
      setEditorOpen(true);
    }
  }, []);

  if (!current) return null;

  async function runAction(fn: () => Promise<unknown>, successText: string) {
    setActing(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: "success", text: successText });
      load();
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof ApiError ? e.message : "操作失败" });
    } finally {
      setActing(false);
    }
  }

  function submitPlan(plan: TourPlan) {
    return runAction(() => apiPost(`/api/tour-plans/${plan.id}/submit`), "计划已提交审批");
  }

  function reviewPlan(plan: TourPlan, action: "APPROVE" | "REJECT") {
    if (!current) return;
    if (action === "REJECT") {
      const reason = window.prompt("请输入驳回原因:");
      if (!reason) return;
      return runAction(
        () => apiPost(`/api/tour-plans/${plan.id}/review`, { action, approverId: current.id, reason }),
        "已驳回该计划"
      );
    }
    return runAction(
      () => apiPost(`/api/tour-plans/${plan.id}/review`, { action, approverId: current.id }),
      "已批准该计划"
    );
  }

  return (
    <div>
      <PageHeader
        title="周计划"
        desc={`本周:${WEEK_START_LABEL} 起(周一)`}
        extra={
          !myPlans.length ? (
            <Button onClick={() => { setEditingPlan(null); setEditorOpen(true); }}>创建周计划</Button>
          ) : undefined
        }
      />

      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载周计划…" />}

      {!loading && !error && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">我的本周计划</h2>
            {myPlans.length === 0 ? (
              <Card>
                <Empty text="本周暂无计划" action={<Button onClick={() => setEditorOpen(true)}>创建周计划</Button>} />
              </Card>
            ) : (
              <div className="space-y-4">
                {myPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    actions={
                      canEditPlan(plan.status) ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setEditingPlan(plan); setEditorOpen(true); }}>编辑</Button>
                          <Button size="sm" disabled={acting} onClick={() => submitPlan(plan)}>提交审批</Button>
                        </div>
                      ) : undefined
                    }
                    onStartVisit={setVisitItem}
                  />
                ))}
              </div>
            )}
          </section>

          {myPlans.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">本周日历</h2>
              <div className="grid gap-2 md:grid-cols-7">
                {weekDays.map((day) => {
                  const dateKey = businessDateKey(day);
                  const items = myPlans.flatMap((plan) =>
                    plan.items
                      .filter((item) => businessDateKey(item.planDate) === dateKey)
                      .map((item) => ({ plan, item }))
                  );
                  return (
                    <Card key={dateKey} className="min-h-32 p-3">
                      <div className="mb-2 text-xs font-medium text-slate-500">
                        {fmtDate(day.toISOString())} {fmtWeekday(day.toISOString())}
                      </div>
                      <div className="space-y-2">
                        {items.map(({ plan, item }) => (
                          <div key={item.id} className="rounded-md bg-slate-50 p-2 text-xs">
                            <div className="font-medium text-slate-700">{item.hcp?.name ?? item.hcoName ?? "未指定对象"}</div>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-slate-400">{item.status === "COMPLETED" ? "已完成" : item.status === "CANCELLED" ? "已取消" : "待执行"}</span>
                              {canStartPlanItem(plan.status, item.status, item.visitId) && (
                                <button className="text-emerald-700 hover:underline" onClick={() => setVisitItem(item)}>记录拜访</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {!items.length && <div className="py-4 text-center text-xs text-slate-300">无安排</div>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {manager && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">下属提交的待审批计划({pendingPlans.length})</h2>
              {pendingPlans.length === 0 ? (
                <Card>
                  <Empty text="暂无待审批的计划" />
                </Card>
              ) : (
                <div className="space-y-4">
                  {pendingPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      actions={
                        <div className="flex gap-2">
                          <Button size="sm" disabled={acting} onClick={() => reviewPlan(plan, "APPROVE")}>
                            批准
                          </Button>
                          <Button size="sm" variant="danger" disabled={acting} onClick={() => reviewPlan(plan, "REJECT")}>
                            驳回
                          </Button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <TourPlanEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        employeeId={current.id}
        weekStart={WEEK_START_ISO}
        plan={editingPlan}
        initialHcpId={initialHcpId}
        onSaved={load}
      />
      <VisitFormDialog
        open={Boolean(visitItem)}
        onClose={() => setVisitItem(null)}
        preselectedHcp={visitItem?.hcp ? { id: visitItem.hcp.id, name: visitItem.hcp.name } : null}
        tourPlanItemId={visitItem?.id}
        plannedDate={visitItem?.planDate}
        onSuccess={() => load()}
      />
    </div>
  );
}
