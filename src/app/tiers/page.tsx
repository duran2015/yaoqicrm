"use client";

import { useCallback, useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { apiGet } from "@/lib/api-client";
import { HCO_TYPE_LABELS, TIER_COLORS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { CustomerStats, HcoListItem, Hcp, ListResponse } from "@/lib/types";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Skeleton, Tabs, TierBadge } from "@/components/ui";
import { TierAdjustDialog, assignmentsText } from "@/components/customer";

const PAGE_SIZE = 20;

/** 未分级客户清单(hcp / hco 通用) */
function UngradedTable({ kind }: { kind: "hcp" | "hco" }) {
  const { current } = useUser();
  const [rows, setRows] = useState<(Hcp | HcoListItem)[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(
    (p: number) => {
      setLoading(true);
      setError(null);
      apiGet<ListResponse<Hcp | HcoListItem>>(`/api/${kind}`, { graded: "false", page: p, pageSize: PAGE_SIZE })
        .then((res) => {
          setRows(res.data.slice(0, 50));
          setTotal(Math.min(res.total, 50));
          setLoading(false);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "加载失败");
          setLoading(false);
        });
    },
    [kind]
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">
        未分级客户清单(前 50)
      </div>
      {error && <div className="p-4"><ErrorBox message={error} onRetry={() => load(page)} /></div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">客户编码</th>
            <th className="px-4 py-3 font-medium">客户名称</th>
            {kind === "hco" && <th className="px-4 py-3 font-medium">机构类型</th>}
            <th className="px-4 py-3 font-medium">{kind === "hcp" ? "工作单位" : "所在地"}</th>
            <th className="px-4 py-3 font-medium">合作代表</th>
            <th className="px-4 py-3 font-medium">分级</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <tr key={i}>
                <td colSpan={7} className="px-4 py-3">
                  <Skeleton className="h-5 w-full" />
                </td>
              </tr>
            ))}
          {!loading &&
            rows.map((r) => {
              const isHcp = kind === "hcp";
              const hcp = r as Hcp;
              const hco = r as HcoListItem;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  {kind === "hco" && (
                    <td className="px-4 py-3 text-slate-600">{HCO_TYPE_LABELS[hco.type] ?? hco.type}</td>
                  )}
                  <td className="px-4 py-3 text-slate-600">
                    {isHcp ? (hcp.hco?.name ?? "—") : [hco.province, hco.city].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{assignmentsText(r.assignments)}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={r.tier} />
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => setAdjustTarget({ id: r.id, name: r.name })}>
                      分级
                    </Button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      {!loading && rows.length === 0 && !error && <Empty text="全部客户均已分级" />}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-3">
          <button
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span>
            第 {page} 页 / 共 {totalPages} 页
          </span>
          <button
            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>
      {adjustTarget && current && (
        <TierAdjustDialog
          open
          onClose={() => setAdjustTarget(null)}
          kind={kind}
          customerId={adjustTarget.id}
          currentTier={null}
          onDone={() => load(page)}
        />
      )}
    </Card>
  );
}

export default function TiersPage() {
  const { current } = useUser();
  const [kind, setKind] = useState<"hcp" | "hco">("hcp");
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiGet<CustomerStats>("/api/customers/stats", { type: kind, employeeId: current?.id })
      .then((res) => {
        setStats(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [kind, current?.id]);

  const pieData = stats
    ? [
        { name: "A", value: stats.tierA },
        { name: "B", value: stats.tierB },
        { name: "C", value: stats.tierC },
        { name: "D", value: stats.tierD },
        { name: "未分级", value: stats.ungraded },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <PageHeader title="客户分级" desc="客户分级分布与未分级客户处理" />

      <Tabs
        tabs={[
          { key: "hcp", label: "个人客户(HCP)" },
          { key: "hco", label: "企业客户(HCO)" },
        ]}
        active={kind}
        onChange={(k) => setKind(k as "hcp" | "hco")}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-700">分级分布</h3>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorBox message={error} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={TIER_COLORS[entry.name] ?? "#cbd5e1"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} 个`, "客户数"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card className="grid grid-cols-2 divide-x divide-slate-100 lg:col-span-2 lg:grid-cols-3">
          {[
            { label: "客户总数", value: stats?.total },
            { label: "未分级", value: stats?.ungraded },
            { label: "A级", value: stats?.tierA },
            { label: "B级", value: stats?.tierB },
            { label: "C级", value: stats?.tierC },
            { label: "D级", value: stats?.tierD },
          ].map((item) => (
            <div key={item.label} className="px-5 py-4">
              <div className="text-xs text-slate-400">{item.label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {loading ? <span className="text-slate-300">…</span> : (item.value ?? 0)}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <UngradedTable key={kind} kind={kind} />
    </div>
  );
}
