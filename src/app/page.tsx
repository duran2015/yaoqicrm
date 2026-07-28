"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api-client";
import { AS_OF, ROLE_LABELS, TODAY_FROM, TODAY_TO, VISIT_TYPE_LABELS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { DashboardData, ListResponse, Visit } from "@/lib/types";
import { fmtDateShort, fmtDateTime, fmtPercent } from "@/lib/utils";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Skeleton, TierBadge } from "@/components/ui";

const TIER_COLORS: Record<string, string> = { A: "#ef4444", B: "#3b82f6", C: "#94a3b8", D: "#cbd5e1", 未分级: "#e2e8f0" };

function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

export default function DashboardPage() {
  const { current } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<DashboardData>("/api/analytics/dashboard", { employeeId: current.id, asOf: AS_OF }),
      apiGet<ListResponse<Visit>>("/api/visits", { employeeId: current.id, from: TODAY_FROM, to: TODAY_TO }),
    ])
      .then(([dash, visits]) => {
        setData(dash);
        setTodayVisits(visits.data.slice(0, 5));
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current]);

  useEffect(load, [load]);

  if (!current) return null;

  const tierData = data
    ? (Object.entries(data.hcpTierDistribution) as [string, number][]).map(([tier, count]) => ({
        name: `${tier} 级`,
        value: count,
        tier,
      }))
    : [];
  const coveredHcp = data ? data.hcpTierDistribution.A + data.hcpTierDistribution.B + data.hcpTierDistribution.C : 0;

  return (
    <div>
      <PageHeader
        title="仪表盘"
        desc={`数据基准日期:${AS_OF}`}
        extra={
          data?.scope.isManager ? (
            <Badge tone="teal" className="px-3 py-1.5 text-sm">
              团队聚合视图 · 含 {data.scope.employeeCount} 名下属员工
            </Badge>
          ) : (
            <Badge tone="slate" className="px-3 py-1.5 text-sm">
              {ROLE_LABELS[current.role] ?? current.role}个人视图
            </Badge>
          )
        }
      />

      {loading && <Loading text="正在加载工作台数据…" />}
      {error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && data && (
        <div className="space-y-5">
          {/* KPI 卡片 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="今日拜访" value={`${data.todayVisits} 次`} sub={AS_OF} />
            <KpiCard
              label="本周计划完成率"
              value={fmtPercent(data.week.completionRate)}
              sub={`已完成 ${data.week.completedVisits} / 计划 ${data.week.plannedVisits} 条`}
            />
            <KpiCard
              label="本月拜访 / 目标"
              value={
                <span>
                  {data.month.visits}
                  <span className="text-base font-normal text-slate-400"> / {data.month.visitTarget}</span>
                </span>
              }
              sub={`达成率 ${fmtPercent(data.month.attainmentRate)} · ${data.month.period}`}
            />
            <KpiCard
              label="覆盖医生数"
              value={`${coveredHcp} 位`}
              sub={`A ${data.hcpTierDistribution.A} · B ${data.hcpTierDistribution.B} · C ${data.hcpTierDistribution.C}`}
            />
            {data.pendingEvaluations !== undefined && (
              <Link href="/evaluations" className="block">
                <Card className="h-full p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/40">
                  <div className="text-sm text-slate-500">待评定拜访</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {data.pendingEvaluations}
                    <span className="text-base font-normal text-slate-400"> 条</span>
                  </div>
                  <div className="mt-1 text-xs text-amber-600">下属提交待我反馈 → 前往评定</div>
                </Card>
              </Link>
            )}
          </div>

          {/* 图表 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium text-slate-700">近 14 天拜访趋势</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.visitTrend14d} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(v: string) => fmtDateShort(v)} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value) => [`${value} 次`, "拜访数"]}
                      labelFormatter={(label) => `日期:${label}`}
                    />
                    <Area type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} fill="url(#trendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-medium text-slate-700">HCP 分级分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tierData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                      {tierData.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} 位`, "医生数"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* 今日拜访 */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-medium text-slate-700">今日拜访(最近 5 条)</h3>
              <Link href="/visits" className="text-xs text-emerald-600 hover:text-emerald-700">
                查看全部 →
              </Link>
            </div>
            {todayVisits.length === 0 ? (
              <Empty text="今日暂无拜访记录" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {todayVisits.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={v.hcp ? `/hcp/${v.hcp.id}` : "/visits"}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-800">{v.hcp?.name ?? "未关联医生"}</span>
                        {v.hcp?.tier && <TierBadge tier={v.hcp.tier} />}
                        <span className="text-xs text-slate-400">{v.hco?.name ?? v.hcp?.hco?.name ?? ""}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <Badge tone="teal">{VISIT_TYPE_LABELS[v.type] ?? v.type}</Badge>
                        {v.outcome && <span>{v.outcome}</span>}
                        <span>{fmtDateTime(v.visitDate)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {!loading && !error && !data && <Empty />}
      {loading && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
    </div>
  );
}
