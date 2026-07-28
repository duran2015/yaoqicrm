"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { SENTIMENT_LABELS, VALIDITY_LABELS, VISIT_FROM, VISIT_TO, VISIT_TYPE_LABELS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { ListResponse, Visit } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Button, Empty, ErrorBox, Loading, Notice, PageHeader, Select, Skeleton, SourceBadge, ValidityBadge } from "@/components/ui";
import { VisitFormDialog } from "@/components/visit-form";

export default function VisitsPage() {
  const { current } = useUser();
  const [type, setType] = useState("");
  const [validity, setValidity] = useState("");
  const [source, setSource] = useState("");
  const [rows, setRows] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    setError(null);
    apiGet<ListResponse<Visit>>("/api/visits", {
      employeeId: current.id,
      from: VISIT_FROM,
      to: VISIT_TO,
      type,
      validityStatus: validity,
      source,
      page,
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
  }, [current, type, validity, source, page]);

  useEffect(load, [load]);

  // 筛选变化时回到第 1 页
  const onType = (v: string) => {
    setType(v);
    setPage(1);
  };
  const onValidity = (v: string) => {
    setValidity(v);
    setPage(1);
  };
  const onSource = (v: string) => {
    setSource(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 侧边栏"记录拜访"提交成功后刷新
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("pharma-crm:visit-created", handler);
    return () => window.removeEventListener("pharma-crm:visit-created", handler);
  }, [load]);

  if (!current) return null;

  return (
    <div>
      <PageHeader
        title="拜访记录"
        desc={`2026-06 ~ 2026-07,共 ${total} 条`}
        extra={<Button onClick={() => setDialogOpen(true)}>+ 记录拜访</Button>}
      />

      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={type} onChange={(e) => onType(e.target.value)}>
          <option value="">全部类型</option>
          {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={validity} onChange={(e) => onValidity(e.target.value)}>
          <option value="">全部有效性</option>
          {Object.entries(VALIDITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={source} onChange={(e) => onSource(e.target.value)}>
          <option value="">全部来源</option>
          <option value="MANUAL">手工录入</option>
          <option value="AI">AI 录入</option>
          <option value="IMPORT">导入</option>
        </Select>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">医生</th>
              <th className="px-4 py-3 font-medium">医院</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">结果</th>
              <th className="px-4 py-3 font-medium">时长</th>
              <th className="px-4 py-3 font-medium">有效性</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              [0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              rows.map((v) => (
                <VisitRow
                  key={v.id}
                  visit={v}
                  expanded={expandedId === v.id}
                  onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                />
              ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && !error && <Empty text="该时间范围内暂无拜访记录" />}
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

      <VisitFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setNotice("拜访已提交");
          load();
        }}
      />
    </div>
  );
}

function VisitRow({ visit: v, expanded, onToggle }: { visit: Visit; expanded: boolean; onToggle: () => void }) {
  const purposeList = (v.purposes ?? v.purpose ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <tr className="cursor-pointer hover:bg-emerald-50/40" onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(v.visitDate)}</td>
        <td className="px-4 py-3">
          {v.hcp ? (
            <Link
              href={`/hcp/${v.hcp.id}`}
              className="font-medium text-emerald-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {v.hcp.name}
            </Link>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-slate-600">{v.hco?.name ?? v.hcp?.hco?.name ?? "—"}</td>
        <td className="px-4 py-3">
          <Badge tone="teal">{VISIT_TYPE_LABELS[v.type] ?? v.type}</Badge>
        </td>
        <td className="px-4 py-3 text-slate-600">{v.outcome ?? "—"}</td>
        <td className="px-4 py-3 text-slate-600">{v.duration != null ? `${v.duration} 分钟` : "—"}</td>
        <td className="px-4 py-3">
          <ValidityBadge status={v.validityStatus} />
        </td>
        <td className="px-4 py-3 text-right text-xs text-slate-400">{expanded ? "收起 ▲" : "展开 ▼"}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-slate-50/60 px-6 py-4">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <ValidityBadge status={v.validityStatus} reason={v.invalidReason} />
                <SourceBadge source={v.source} />
                {v.receiver && <span className="text-slate-500">接收人:{v.receiver.name}</span>}
                {v.evaluatedBy && v.evaluatedAt && (
                  <span className="text-slate-400">
                    {v.evaluatedBy.name} 评定于 {fmtDateTime(v.evaluatedAt)}
                  </span>
                )}
              </div>
              {purposeList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-slate-600">目的:</span>
                  {purposeList.map((p) => (
                    <Badge key={p} tone="slate">
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
              {v.notes && <p className="rounded bg-white px-3 py-2 text-xs leading-relaxed shadow-sm">{v.notes}</p>}
              {v.summary && (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="mb-1 text-xs font-medium text-slate-600">📝 人工总结</div>
                  <p className="text-xs leading-relaxed text-slate-700">{v.summary}</p>
                </div>
              )}
              {v.products.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-slate-600">讨论产品:</span>
                  {v.products.map((p) => (
                    <Badge key={p.id} tone="blue">
                      {p.product.brand}
                      {p.feedback ? `:${p.feedback}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
              {v.samples.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-slate-600">发放样品:</span>
                  {v.samples.map((s) => (
                    <Badge key={s.id} tone="amber">
                      {s.lot.product.brand}({s.lot.lotNumber})× {s.quantity}
                    </Badge>
                  ))}
                </div>
              )}
              {(v.checkins?.length ?? 0) > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-slate-600">签到记录:</span>
                  <ul className="mt-1 space-y-1">
                    {v.checkins!.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">{fmtDateTime(c.checkinTime)}</span>
                        <span className="text-slate-600">{c.locationName ?? "未填写地点"}</span>
                        {c.status === "LOCATION_MISMATCH" ? (
                          <Badge tone="red">地点异常</Badge>
                        ) : (
                          <Badge tone="emerald">正常</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {v.aiSummary && (
                <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-700">
                    ✨ AI 摘要
                    <Badge tone="blue">AI</Badge>
                    {v.aiSentiment && <Badge tone="emerald">{SENTIMENT_LABELS[v.aiSentiment] ?? v.aiSentiment}</Badge>}
                  </div>
                  <p className="text-xs leading-relaxed text-emerald-900">{v.aiSummary}</p>
                </div>
              )}
              {v.nextStep && (
                <div className="text-xs">
                  <span className="font-medium text-slate-600">下一步:</span>
                  {v.nextStep}
                </div>
              )}
              {!v.notes && !v.summary && !v.nextStep && v.products.length === 0 && v.samples.length === 0 && !v.aiSummary && (
                <div className="text-xs text-slate-400">无更多明细</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
