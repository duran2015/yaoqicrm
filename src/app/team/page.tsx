"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet } from "@/lib/api-client";
import { AS_OF, isManagerRole, ROLE_LABELS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { Employee, TerritoryAnalytics } from "@/lib/types";
import { fmtPercent } from "@/lib/utils";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";

function OrgNode({ node, isRoot }: { node: Employee; isRoot?: boolean }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <span className={`text-sm ${isRoot ? "font-semibold text-slate-900" : "text-slate-700"}`}>
          {node.name}
          {node.employeeCode && <span className="ml-1 font-mono text-xs font-normal text-slate-400">{node.employeeCode}</span>}
          {isRoot && <span className="ml-1 text-xs font-normal text-emerald-600">(我)</span>}
        </span>
        <Badge tone={node.role === "MR" ? "slate" : "teal"}>{ROLE_LABELS[node.role] ?? node.role}</Badge>
        <span className="text-xs text-slate-400">{node.division}</span>
        {node.territory?.name && <span className="text-xs text-slate-400">· {node.territory.name}</span>}
        {node.departmentPath && <span className="text-xs text-slate-400">· 部门:{node.departmentPath}</span>}
      </div>
      {node.subordinates && node.subordinates.length > 0 && (
        <ul className="ml-4 border-l border-slate-200 pl-4">
          {node.subordinates.map((s) => (
            <OrgNode key={s.id} node={s} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TeamPage() {
  const { current, subtreeRoot } = useUser();
  const [data, setData] = useState<TerritoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const manager = isManagerRole(current?.role);

  const load = useCallback(() => {
    if (!current || !isManagerRole(current.role)) return;
    setLoading(true);
    setError(null);
    apiGet<TerritoryAnalytics>("/api/analytics/territory", { employeeId: current.id, asOf: AS_OF })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current]);

  useEffect(load, [load]);

  if (!current) return null;

  if (!manager) {
    return (
      <div>
        <PageHeader title="团队" />
        <Card>
          <Empty text="团队视图仅地区经理(ASM)/ 大区经理(RSM)可用,请切换身份" />
        </Card>
      </div>
    );
  }

  const chartData = (data?.data ?? []).map((r) => ({
    name: r.employee.name,
    拜访数: r.visitCount,
    覆盖医生数: r.coveredHcpCount,
  }));

  return (
    <div>
      <PageHeader title="团队" desc={`${data?.period ?? "2026-07"} 月度辖区效能(按代表聚合,数据基准 ${AS_OF})`} />

      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && manager && <Loading text="正在加载团队数据…" />}

      {!loading && !error && data && (
        <div className="space-y-5">
          {/* 组织架构 */}
          {subtreeRoot && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-medium text-slate-700">组织架构(我的下属树)</h3>
              <ul>
                <OrgNode node={subtreeRoot} isRoot />
              </ul>
            </Card>
          )}

          {/* 对比图 */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-medium text-slate-700">代表拜访量与覆盖对比</h3>
            {chartData.length === 0 ? (
              <Empty text="暂无团队数据" />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="拜访数" fill="#059669" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="覆盖医生数" fill="#0d9488" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* 明细表 */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">代表</th>
                  <th className="px-4 py-3 font-medium">事业部</th>
                  <th className="px-4 py-3 font-medium">辖区</th>
                  <th className="px-4 py-3 text-right font-medium">本月拜访数</th>
                  <th className="px-4 py-3 text-right font-medium">覆盖 HCP 数</th>
                  <th className="px-4 py-3 text-right font-medium">A 级覆盖率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((r) => (
                  <tr key={r.employee.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.employee.name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.employee.division}</td>
                    <td className="px-4 py-3 text-slate-600">{r.employee.territory?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.visitCount}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.coveredHcpCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={r.aTier.coverageRate !== null && r.aTier.coverageRate >= 1 ? "text-emerald-700" : "text-slate-700"}>
                        {r.aTier.covered}/{r.aTier.total}({fmtPercent(r.aTier.coverageRate)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.data.length === 0 && <Empty text="暂无团队数据" />}
          </div>
        </div>
      )}
    </div>
  );
}
