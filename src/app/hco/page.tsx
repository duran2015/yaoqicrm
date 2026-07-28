"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { HCO_CATEGORY_OPTIONS, HCO_TYPE_LABELS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { HcoListItem, ListResponse } from "@/lib/types";
import { Empty, ErrorBox, Input, Loading, PageHeader, Select, Skeleton, TierBadge } from "@/components/ui";
import { CustomerStatsBar, assignmentsText } from "@/components/customer";

function tierParams(v: string): { tier?: string; graded?: string } {
  if (v === "ungraded") return { graded: "false" };
  if (v) return { tier: v };
  return {};
}

export default function HcoListPage() {
  const router = useRouter();
  const { current } = useUser();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [category, setCategory] = useState("");
  const [assignFilter, setAssignFilter] = useState("");
  const [rows, setRows] = useState<HcoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback(
    (q: string, t: string, c: string, a: string, p: number) => {
      setLoading(true);
      setError(null);
      apiGet<ListResponse<HcoListItem>>("/api/hco", {
        query: q,
        ...tierParams(t),
        category: c || undefined,
        mine: a === "mine" ? "true" : undefined,
        employeeId: a === "mine" ? current?.id : undefined,
        page: p,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          setRows(res.data);
          setTotal(res.total);
          setLoading(false);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "加载失败");
          setLoading(false);
        });
    },
    [current?.id]
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(query, tierFilter, category, assignFilter, page), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, tierFilter, category, assignFilter, page, load]);

  const reset = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="企业客户" desc={`共 ${total} 家机构`} />

      {/* 顶部统计卡条 */}
      <CustomerStatsBar type="hco" />

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="搜索机构名称 / 地址…"
          value={query}
          onChange={(e) => reset(setQuery)(e.target.value)}
        />
        <Select value={tierFilter} onChange={(e) => reset(setTierFilter)(e.target.value)}>
          <option value="">全部分级</option>
          <option value="ungraded">未分级</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
          <option value="D">D 级</option>
        </Select>
        <Select value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
          <option value="">全部分类</option>
          {HCO_CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={assignFilter} onChange={(e) => reset(setAssignFilter)(e.target.value)}>
          <option value="">全部客户</option>
          <option value="mine">我负责</option>
        </Select>
      </div>

      {error && <ErrorBox message={error} onRetry={() => load(query, tierFilter, category, assignFilter, page)} />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">客户编码</th>
              <th className="px-4 py-3 font-medium">客户名称</th>
              <th className="px-4 py-3 font-medium">机构类型</th>
              <th className="px-4 py-3 font-medium">所在地</th>
              <th className="px-4 py-3 font-medium">客户分级</th>
              <th className="px-4 py-3 font-medium">客户分类</th>
              <th className="px-4 py-3 font-medium">合作代表</th>
              <th className="px-4 py-3 font-medium">KA负责人</th>
              <th className="px-4 py-3 font-medium">国考成绩</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              rows.map((h) => (
                <tr key={h.id} className="cursor-pointer hover:bg-emerald-50/40" onClick={() => router.push(`/hco/${h.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{h.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{h.name}</td>
                  <td className="px-4 py-3 text-slate-600">{HCO_TYPE_LABELS[h.type] ?? h.type}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[h.province, h.city].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={h.tier} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{h.category ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{assignmentsText(h.assignments)}</td>
                  <td className="px-4 py-3 text-slate-600">{h.kaOwner?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {h.latestExam ? `${h.latestExam.year} ${h.latestExam.grade}` : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && <Empty text="未找到匹配的机构" />}
        {loading && rows.length === 0 && <Loading />}
      </div>

      {/* 分页控件 */}
      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
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
    </div>
  );
}
