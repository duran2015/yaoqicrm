"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { Hcp, ListResponse } from "@/lib/types";
import { Card, Empty, ErrorBox, Input, Loading, PageHeader, Select, Skeleton, TierBadge } from "@/components/ui";
import { assignmentsText } from "@/components/customer";

function tierParams(v: string): { tier?: string; graded?: string } {
  if (v === "ungraded") return { graded: "false" };
  if (v) return { tier: v };
  return {};
}

/** 关键客户(KOL):标签含 KOL 的医生 */
export default function KolListPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [rows, setRows] = useState<Hcp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

  const load = useCallback((q: string, t: string, p: number) => {
    setLoading(true);
    setError(null);
    apiGet<ListResponse<Hcp>>("/api/hcp", {
      query: q,
      tags: "KOL",
      ...tierParams(t),
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
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(query, tierFilter, page), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, tierFilter, page, load]);

  const reset = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="关键客户" desc={`共 ${total} 位 KOL`} />

      {/* 说明卡片 */}
      <Card className="mb-4 border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2 text-sm text-emerald-800">
          <span className="text-base">⭐</span>
          关键客户(KOL):学术带头人,需重点维护
        </div>
      </Card>

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder="搜索姓名 / 科室 / 机构…"
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
      </div>

      {error && <ErrorBox message={error} onRetry={() => load(query, tierFilter, page)} />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">客户编码</th>
              <th className="px-4 py-3 font-medium">客户姓名</th>
              <th className="px-4 py-3 font-medium">工作单位</th>
              <th className="px-4 py-3 font-medium">客户分级</th>
              <th className="px-4 py-3 font-medium">科室</th>
              <th className="px-4 py-3 font-medium">合作代表</th>
              <th className="px-4 py-3 font-medium">标签</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              rows.map((h) => (
                <tr key={h.id} className="cursor-pointer hover:bg-emerald-50/40" onClick={() => router.push(`/hcp/${h.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{h.code ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{h.name}</td>
                  <td className="px-4 py-3 text-slate-600">{h.hco?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={h.tier} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{h.specialty ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{assignmentsText(h.assignments)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{h.tags ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && <Empty text="暂无关键客户" />}
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
