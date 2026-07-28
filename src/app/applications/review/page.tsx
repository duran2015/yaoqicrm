"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { isManagerRole, PAYLOAD_FIELD_LABELS, PAYLOAD_NESTED_LABELS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { CustomerApplication, ListResponse } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import {
  ApplicationStatusBadge, ApplicationTypeBadge, Button, Card, Dialog, Empty, ErrorBox,
  Field, Loading, Notice, PageHeader, Textarea,
} from "@/components/ui";

/** payload 只读渲染:按字段中文标签展示键值对;数组子记录展开 */
function PayloadView({ payload, hcoMap }: { payload: Record<string, unknown>; hcoMap: Map<string, string> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <Empty text="无表单内容" />;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
        {entries
          .filter(([, v]) => !Array.isArray(v))
          .map(([k, v]) => (
            <div key={k} className="text-sm">
              <dt className="text-xs text-slate-400">{PAYLOAD_FIELD_LABELS[k] ?? k}</dt>
              <dd className="mt-0.5 text-slate-700">
                {k === "hcoId" ? (hcoMap.get(String(v)) ?? String(v)) : String(v)}
              </dd>
            </div>
          ))}
      </dl>
      {entries
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => (
          <div key={k}>
            <div className="mb-1 text-xs text-slate-400">{PAYLOAD_FIELD_LABELS[k] ?? k}</div>
            <div className="space-y-1.5">
              {(v as Record<string, unknown>[]).map((row, i) => (
                <div key={i} className="flex flex-wrap gap-x-4 gap-y-0.5 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {typeof row === "object" && row !== null
                    ? Object.entries(row)
                        .filter(([, val]) => val !== null && val !== undefined && val !== "")
                        .map(([rk, rv]) => (
                          <span key={rk}>
                            {PAYLOAD_NESTED_LABELS[rk] ?? rk}:{typeof rv === "boolean" ? (rv ? "是" : "否") : String(rv)}
                          </span>
                        ))
                    : String(row)}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

/** 建档审核(仅 ASM/RSM/ADMIN):待审核 + 已审核历史 */
export default function ApplicationReviewPage() {
  const { current, employees } = useUser();
  const manager = isManagerRole(current?.role);

  const [pending, setPending] = useState<CustomerApplication[]>([]);
  const [history, setHistory] = useState<CustomerApplication[]>([]);
  const [hcoMap, setHcoMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<{ href: string; label: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<Map<string, Record<string, unknown>>>(new Map());

  const [rejectTarget, setRejectTarget] = useState<CustomerApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const empName = useCallback(
    (id: string) => employees.find((e) => e.id === id)?.name ?? id,
    [employees]
  );

  const load = useCallback(() => {
    if (!current || !isManagerRole(current.role)) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<ListResponse<CustomerApplication>>("/api/applications", { status: "PENDING" }),
      apiGet<ListResponse<CustomerApplication>>("/api/applications", { status: "APPROVED" }),
      apiGet<ListResponse<CustomerApplication>>("/api/applications", { status: "REJECTED" }),
      apiGet<ListResponse<{ id: string; name: string }>>("/api/hco", { pageSize: 100 }),
    ])
      .then(([pend, approved, rejected, hcos]) => {
        setPending(pend.data);
        setHistory(
          [...approved.data, ...rejected.data].sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""))
        );
        setHcoMap(new Map(hcos.data.map((h) => [h.id, h.name])));
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current]);

  useEffect(load, [load]);

  async function toggleExpand(app: CustomerApplication) {
    if (expandedId === app.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(app.id);
    if (!payloads.has(app.id)) {
      try {
        const detail = await apiGet<CustomerApplication>(`/api/applications/${app.id}`);
        setPayloads((m) => new Map(m).set(app.id, (detail.parsedPayload ?? {}) as Record<string, unknown>));
      } catch {
        try {
          setPayloads((m) => new Map(m).set(app.id, JSON.parse(app.payload) as Record<string, unknown>));
        } catch {
          setPayloads((m) => new Map(m).set(app.id, {}));
        }
      }
    }
  }

  async function review(app: CustomerApplication, action: "APPROVE" | "REJECT", reason?: string) {
    if (!current) return;
    setSubmitting(true);
    try {
      const updated = await apiPost<CustomerApplication>(`/api/applications/${app.id}/review`, {
        action,
        reviewerId: current.id,
        reason,
      });
      setRejectTarget(null);
      setRejectReason("");
      setDialogError(null);
      if (action === "APPROVE") {
        setNotice("档案已建立");
        if (updated.createdHcpId) setCreatedLink({ href: `/hcp/${updated.createdHcpId}`, label: "查看新档案(个人客户)→" });
        else if (updated.createdHcoId) setCreatedLink({ href: `/hco/${updated.createdHcoId}`, label: "查看新档案(企业客户)→" });
        else setCreatedLink(null);
      } else {
        setNotice("已驳回该申请");
        setCreatedLink(null);
      }
      setTimeout(() => {
        setNotice(null);
        setCreatedLink(null);
      }, 8000);
      setExpandedId(null);
      load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "操作失败,请稍后重试";
      if (action === "REJECT") setDialogError(msg);
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!current) return null;

  if (!manager) {
    return (
      <div>
        <PageHeader title="建档审核" />
        <Card>
          <Empty text="仅地区经理(ASM)/ 大区经理(RSM)可访问建档审核" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="建档审核" desc={`待审核 ${pending.length} 条`} />

      {notice && (
        <Notice
          kind="success"
          text={notice}
          onClose={() => {
            setNotice(null);
            setCreatedLink(null);
          }}
        />
      )}
      {createdLink && (
        <div className="mb-4 -mt-2">
          <Link href={createdLink.href} className="text-sm text-emerald-600 hover:text-emerald-700">
            {createdLink.label}
          </Link>
        </div>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}

      {/* 待审核 */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">待审核</div>
        {loading ? (
          <Loading text="正在加载申请…" />
        ) : pending.length === 0 ? (
          <Empty text="暂无待审核的建档申请" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">客户池</th>
                <th className="px-4 py-3 font-medium">提交时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.map((app) => (
                <Fragment key={app.id}>
                  <tr className="cursor-pointer hover:bg-emerald-50/40" onClick={() => toggleExpand(app)}>
                    <td className="px-4 py-3">
                      <ApplicationTypeBadge type={app.type} />
                    </td>
                    <td className="px-4 py-3 text-slate-800">{empName(app.applicantId)}</td>
                    <td className="px-4 py-3 text-slate-600">{app.pool ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDateTime(app.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-emerald-600">{expandedId === app.id ? "收起 ▲" : "展开 ▼"}</td>
                  </tr>
                  {expandedId === app.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50/60 px-6 py-4">
                        <PayloadView payload={payloads.get(app.id) ?? {}} hcoMap={hcoMap} />
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={submitting}
                            onClick={() => {
                              setRejectTarget(app);
                              setRejectReason("");
                              setDialogError(null);
                            }}
                          >
                            驳回
                          </Button>
                          <Button size="sm" disabled={submitting} onClick={() => review(app, "APPROVE")}>
                            批准
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 已审核历史 */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">已审核</div>
        {loading ? (
          <Loading />
        ) : history.length === 0 ? (
          <Empty text="暂无已审核记录" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">客户池</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">审核人</th>
                <th className="px-4 py-3 font-medium">审核时间</th>
                <th className="px-4 py-3 font-medium">档案</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-3">
                    <ApplicationTypeBadge type={app.type} />
                  </td>
                  <td className="px-4 py-3 text-slate-800">{empName(app.applicantId)}</td>
                  <td className="px-4 py-3 text-slate-600">{app.pool ?? "—"}</td>
                  <td className="px-4 py-3">
                    <ApplicationStatusBadge status={app.status} />
                    {app.status === "REJECTED" && app.rejectReason && (
                      <div className="mt-0.5 text-xs text-red-500">{app.rejectReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{app.reviewerId ? empName(app.reviewerId) : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDateTime(app.reviewedAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    {app.createdHcpId && (
                      <Link href={`/hcp/${app.createdHcpId}`} className="text-emerald-600 hover:text-emerald-700">
                        查看档案 →
                      </Link>
                    )}
                    {app.createdHcoId && (
                      <Link href={`/hco/${app.createdHcoId}`} className="text-emerald-600 hover:text-emerald-700">
                        查看档案 →
                      </Link>
                    )}
                    {!app.createdHcpId && !app.createdHcoId && "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 驳回弹窗 */}
      <Dialog open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="驳回建档申请">
        <div className="space-y-4">
          <Field label="驳回原因" required>
            <Textarea
              rows={3}
              placeholder="如:资料不完整,请补充执业证书"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </Field>
          {dialogError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={submitting}>
              取消
            </Button>
            <Button
              variant="danger"
              disabled={submitting || !rejectReason.trim()}
              onClick={() => rejectTarget && review(rejectTarget, "REJECT", rejectReason.trim())}
            >
              {submitting ? "提交中…" : "确认驳回"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
