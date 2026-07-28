"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { isManagerRole, PLAN_STATUS_LABELS, WEEK_START_ISO, WEEK_START_LABEL } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { ListResponse, TourPlan } from "@/lib/types";
import { fmtDate, fmtWeekday } from "@/lib/utils";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Notice, PageHeader, TierBadge } from "@/components/ui";

const STATUS_TONES: Record<string, "slate" | "amber" | "emerald" | "red"> = {
  DRAFT: "slate",
  SUBMITTED: "amber",
  APPROVED: "emerald",
  REJECTED: "red",
};

function PlanCard({
  plan,
  actions,
}: {
  plan: TourPlan;
  actions?: React.ReactNode;
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
              {item.note && <span className="text-xs text-slate-400">{item.note}</span>}
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

  const manager = isManagerRole(current?.role);

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
      <PageHeader title="周计划" desc={`本周:${WEEK_START_LABEL} 起(周一)`} />

      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载周计划…" />}

      {!loading && !error && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">我的本周计划</h2>
            {myPlans.length === 0 ? (
              <Card>
                <Empty text="本周暂无计划" />
              </Card>
            ) : (
              <div className="space-y-4">
                {myPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    actions={
                      plan.status === "DRAFT" || plan.status === "REJECTED" ? (
                        <Button size="sm" disabled={acting} onClick={() => submitPlan(plan)}>
                          提交审批
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>

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
    </div>
  );
}
