"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { AccountPlan, ListResponse } from "@/lib/types";
import { AccountPlanEditor } from "@/components/account-plan-editor";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Notice, PageHeader, Select } from "@/components/ui";

export default function AccountPlansPage() {
  const { current, employees } = useUser();
  const [year, setYear] = useState(2026);
  const [status, setStatus] = useState("");
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [initialHcoId, setInitialHcoId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiGet<ListResponse<AccountPlan>>("/api/account-plans", { year, status })
      .then((response) => { setPlans(response.data); setError(null); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [year, status]);
  useEffect(load, [load]);
  useEffect(() => {
    const hcoId = new URLSearchParams(window.location.search).get("hcoId");
    if (hcoId) { setInitialHcoId(hcoId); setEditorOpen(true); }
  }, []);
  if (!current) return null;

  return (
    <div>
      <PageHeader title="客户策略" desc="围绕战略医院管理年度目标、关键关系人与执行里程碑" extra={<Button onClick={() => setEditorOpen(true)}>创建 Account Plan</Button>} />
      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      <Card className="mb-5 flex gap-3 p-4">
        <Select value={year} onChange={(event) => setYear(Number(event.target.value))}><option value={2026}>2026 年</option><option value={2027}>2027 年</option></Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="ACTIVE">推进中</option><option value="CLOSED">已关闭</option></Select>
      </Card>
      {loading ? <Loading text="正在汇总客户策略…" /> : !plans.length ? <Card><Empty text="暂无 Account Plan" action={<Button onClick={() => setEditorOpen(true)}>创建计划</Button>} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/account-plans/${plan.id}`}>
              <Card className="h-full p-5 hover:border-emerald-300">
                <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{plan.hco.name}</div><div className="mt-1 text-xs text-slate-500">{plan.year} · {plan.owner.name}</div></div><Badge tone={plan.status === "ACTIVE" ? "emerald" : "slate"}>{plan.status === "ACTIVE" ? "推进中" : "已关闭"}</Badge></div>
                <div className="mt-4 text-sm text-slate-700">{plan.businessGoal}</div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-slate-50 p-2"><div className="text-lg font-semibold">{Math.round(plan.progress.progress * 100)}%</div><div className="text-slate-400">里程碑进度</div></div>
                  <div className="rounded bg-slate-50 p-2"><div className="text-lg font-semibold text-amber-700">{plan.progress.overdue}</div><div className="text-slate-400">逾期</div></div>
                  <div className="rounded bg-slate-50 p-2"><div className="text-lg font-semibold text-red-700">{plan.uncoveredDecisionMakers}</div><div className="text-slate-400">决策人未覆盖</div></div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <AccountPlanEditor open={editorOpen} onClose={() => setEditorOpen(false)} employees={employees} currentId={current.id} initialHcoId={initialHcoId} onSaved={(plan) => { setNotice(`${plan.hco.name} Account Plan 已创建`); load(); }} />
    </div>
  );
}
