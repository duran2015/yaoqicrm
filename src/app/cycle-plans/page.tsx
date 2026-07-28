"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import { isManagerRole } from "@/lib/constants";
import { cyclePlanToTourPlanHref } from "@/lib/cycle-plan";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, TierBadge } from "@/components/ui";

type CycleItem = {
  id: string;
  hcpId: string;
  tierSnapshot: string;
  targetVisits: number;
  completedVisits: number;
  remainingVisits: number;
  hcp: { id: string; name: string; title?: string | null; hco?: { id: string; name: string } | null };
};

type CycleResponse = {
  plan: null | { id: string; status: string; employee: { id: string; name: string } };
  summary: { targetVisits: number; completedVisits: number; achievementRate: number; uncoveredCustomers: number };
  items: CycleItem[];
};

const DEFAULT_MONTH = "2026-07";

export default function CyclePlansPage() {
  const { current, employees, subtreeIds } = useUser();
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [employeeId, setEmployeeId] = useState("");
  const [data, setData] = useState<CycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [frequencies, setFrequencies] = useState({ A: 4, B: 2, C: 1, D: 0 });

  useEffect(() => {
    if (current) setEmployeeId(current.id);
  }, [current]);

  const selectableEmployees = useMemo(() => {
    if (!current || !isManagerRole(current.role)) return current ? [current] : [];
    return employees.filter((employee) => subtreeIds.has(employee.id));
  }, [current, employees, subtreeIds]);

  const load = useCallback(() => {
    if (!employeeId) return;
    setLoading(true);
    apiGet<CycleResponse>("/api/cycle-plans", { employeeId, month })
      .then((response) => { setData(response); setError(null); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [employeeId, month]);

  useEffect(load, [load]);
  if (!current) return null;

  async function createPlan() {
    setCreating(true);
    setError(null);
    try {
      await apiPost("/api/cycle-plans", {
        employeeId,
        createdById: current.id,
        month,
        frequencies,
      });
      setNotice("月度覆盖计划已生成");
      load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  const summary = data?.summary;
  return (
    <div>
      <PageHeader title="月度覆盖" desc="按客户分级管理本月拜访频次与覆盖缺口" />
      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}

      <Card className="mb-5 p-4">
        <div className="grid items-end gap-3 md:grid-cols-[180px_220px_repeat(4,90px)_auto]">
          <Field label="月份"><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Field>
          <Field label="负责人">
            <Select className="w-full" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {selectableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}
            </Select>
          </Field>
          {(["A", "B", "C", "D"] as const).map((tier) => (
            <Field key={tier} label={`${tier}级频次`}>
              <Input type="number" min={0} max={31} value={frequencies[tier]} onChange={(event) => setFrequencies((value) => ({ ...value, [tier]: Number(event.target.value) }))} />
            </Field>
          ))}
          <Button disabled={creating || Boolean(data?.plan)} onClick={createPlan}>
            {creating ? "生成中…" : data?.plan ? "本月已生成" : "生成计划"}
          </Button>
        </div>
      </Card>

      {loading && <Loading text="正在汇总月度覆盖…" />}
      {!loading && data && !data.plan && <Card><Empty text="该员工本月尚未生成覆盖计划" /></Card>}
      {!loading && data?.plan && summary && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["目标拜访", summary.targetVisits],
              ["有效完成", summary.completedVisits],
              ["达成率", `${Math.round(summary.achievementRate * 100)}%`],
              ["未覆盖客户", summary.uncoveredCustomers],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-700">客户覆盖明细</div>
            {!data.items.length ? <Empty text="该代表尚未分配 OWNER 客户" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr><th className="px-5 py-3">客户</th><th className="px-4 py-3">层级</th><th className="px-4 py-3">目标</th><th className="px-4 py-3">完成</th><th className="px-4 py-3">缺口</th><th className="px-5 py-3 text-right">行动</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3"><div className="font-medium text-slate-800">{item.hcp.name}</div><div className="text-xs text-slate-400">{item.hcp.hco?.name ?? "未关联机构"} · {item.hcp.title}</div></td>
                        <td className="px-4 py-3"><TierBadge tier={item.tierSnapshot} /></td>
                        <td className="px-4 py-3">{item.targetVisits}</td>
                        <td className="px-4 py-3">{item.completedVisits}</td>
                        <td className="px-4 py-3">{item.remainingVisits ? <Badge tone="amber">差 {item.remainingVisits} 次</Badge> : <Badge tone="emerald">已达成</Badge>}</td>
                        <td className="px-5 py-3 text-right">{item.remainingVisits > 0 && <Link className="text-emerald-700 hover:underline" href={cyclePlanToTourPlanHref(item.hcpId)}>加入周计划</Link>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
