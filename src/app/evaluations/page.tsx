"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { INVALID_REASON_PRESETS, VISIT_TYPE_LABELS, isManagerRole } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { ListResponse, Visit } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, PageHeader, SourceBadge, Textarea, ValidityBadge } from "@/components/ui";

/** 拜访评定(仅 ASM/RSM/ADMIN):我的待评定收件箱 + 我已评定的历史 */
export default function EvaluationsPage() {
  const { current } = useUser();
  const manager = isManagerRole(current?.role);

  const [pending, setPending] = useState<Visit[]>([]);
  const [history, setHistory] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 无效评定弹窗
  const [invalidTarget, setInvalidTarget] = useState<Visit | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!current || !isManagerRole(current.role)) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<ListResponse<Visit>>("/api/evaluations/pending", { evaluatorId: current.id }),
      // 我已评定的(接收人是我,有效/无效分开拉取合并;分页接口上限 200,取最近 200 条/状态)
      apiGet<ListResponse<Visit>>("/api/visits", { validityStatus: "VALID", pageSize: 200 }),
      apiGet<ListResponse<Visit>>("/api/visits", { validityStatus: "INVALID", pageSize: 200 }),
    ])
      .then(([pend, valid, invalid]) => {
        setPending(pend.data);
        const mine = [...valid.data, ...invalid.data]
          .filter((v) => v.evaluatedBy?.id === current.id)
          .sort((a, b) => (b.evaluatedAt ?? "").localeCompare(a.evaluatedAt ?? ""));
        setHistory(mine);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current]);

  useEffect(load, [load]);

  async function evaluate(visit: Visit, action: "VALID" | "INVALID", invalidReason?: string) {
    if (!current) return;
    setSubmitting(true);
    try {
      await apiPost<Visit>(`/api/visits/${visit.id}/evaluate`, {
        action,
        evaluatorId: current.id,
        reason: invalidReason,
      });
      setNotice(action === "VALID" ? `已标为有效:${visit.hcp?.name ?? ""} ${fmtDateTime(visit.visitDate)}` : "已标为无效");
      setInvalidTarget(null);
      setReason("");
      setDialogError(null);
      load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "评定失败,请稍后重试";
      if (action === "INVALID") setDialogError(msg);
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!current) return null;

  if (!manager) {
    return (
      <div>
        <PageHeader title="拜访评定" />
        <Card>
          <Empty text="拜访评定仅地区经理(ASM)/ 大区经理(RSM)可用,请切换身份" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="拜访评定"
        desc="对下属提交并抄送给你的拜访做有效性反馈"
        extra={
          <Badge tone={pending.length > 0 ? "amber" : "emerald"} className="px-3 py-1.5 text-sm">
            待评定 {pending.length} 条
          </Badge>
        }
      />

      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载待评定拜访…" />}

      {!loading && !error && (
        <div className="space-y-6">
          {/* 待评定收件箱 */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-slate-700">待评定收件箱({pending.length})</h3>
            {pending.length === 0 ? (
              <Card>
                <Empty text="收件箱已清空,没有待评定的拜访" />
              </Card>
            ) : (
              <div className="space-y-3">
                {pending.map((v) => {
                  const purposeList = (v.purposes ?? "").split(",").map((p) => p.trim()).filter(Boolean);
                  const expanded = expandedId === v.id;
                  const hasMismatch = (v.checkins ?? []).some((c) => c.status === "LOCATION_MISMATCH");
                  return (
                    <Card key={v.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{v.hcp?.name ?? "未关联医生"}</span>
                            {v.hcp?.title && <span className="text-xs text-slate-400">{v.hcp.title}</span>}
                            <span className="text-xs text-slate-400">{v.hco?.name ?? ""}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{fmtDateTime(v.visitDate)}</span>
                            <Badge tone="teal">{VISIT_TYPE_LABELS[v.type] ?? v.type}</Badge>
                            <SourceBadge source={v.source} />
                            <span>
                              填写人:{v.employee.name}
                            </span>
                            {hasMismatch && <Badge tone="red">签到地点异常</Badge>}
                          </div>
                          {purposeList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {purposeList.map((p) => (
                                <Badge key={p} tone="slate">
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button size="sm" disabled={submitting} onClick={() => evaluate(v, "VALID")}>
                            ✓ 标有效
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={submitting}
                            onClick={() => {
                              setInvalidTarget(v);
                              setReason("");
                              setDialogError(null);
                            }}
                          >
                            ✗ 标无效
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedId(expanded ? null : v.id)}>
                            {expanded ? "收起 ▲" : "详情 ▼"}
                          </Button>
                        </div>
                      </div>
                      {expanded && (
                        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                          {v.summary && (
                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                              <div className="mb-1 text-xs font-medium text-slate-600">📝 人工总结</div>
                              <p className="text-xs leading-relaxed text-slate-700">{v.summary}</p>
                            </div>
                          )}
                          {v.notes && <p className="rounded bg-slate-50 px-3 py-2 text-xs leading-relaxed">{v.notes}</p>}
                          {v.aiSummary && (
                            <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-700">
                                ✨ AI 摘要 <Badge tone="blue">AI</Badge>
                              </div>
                              <p className="text-xs leading-relaxed text-emerald-900">{v.aiSummary}</p>
                            </div>
                          )}
                          {v.outcome && (
                            <div className="text-xs">
                              <span className="font-medium text-slate-600">结果:</span>
                              {v.outcome}
                            </div>
                          )}
                          {(v.checkins?.length ?? 0) > 0 && (
                            <div className="text-xs">
                              <span className="font-medium text-slate-600">签到:</span>
                              {v.checkins!.map((c) => (
                                <span key={c.id} className="ml-2 inline-flex items-center gap-1.5">
                                  {fmtDateTime(c.checkinTime)} · {c.locationName ?? "未填写地点"}
                                  {c.status === "LOCATION_MISMATCH" ? <Badge tone="red">地点异常</Badge> : <Badge tone="emerald">正常</Badge>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* 已评定历史 */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-slate-700">我已评定({history.length})</h3>
            {history.length === 0 ? (
              <Card>
                <Empty text="暂无评定历史" />
              </Card>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">拜访时间</th>
                      <th className="px-4 py-3 font-medium">医生</th>
                      <th className="px-4 py-3 font-medium">填写人</th>
                      <th className="px-4 py-3 font-medium">评定结果</th>
                      <th className="px-4 py-3 font-medium">评定时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(v.visitDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{v.hcp?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{v.employee.name}</td>
                        <td className="px-4 py-3">
                          <ValidityBadge status={v.validityStatus} reason={v.invalidReason} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(v.evaluatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 标无效弹窗 */}
      <Dialog open={!!invalidTarget} onClose={() => setInvalidTarget(null)} title="标为无效">
        <div className="space-y-4">
          {dialogError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</div>
          )}
          <p className="text-sm text-slate-600">
            将 <span className="font-medium">{invalidTarget?.hcp?.name ?? "该拜访"}</span>(
            {fmtDateTime(invalidTarget?.visitDate)})标为无效,请选择或填写无效原因:
          </p>
          <div className="flex flex-wrap gap-2">
            {INVALID_REASON_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  reason === r
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-red-400 hover:text-red-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <Field label="无效原因" required>
            <Textarea rows={2} placeholder="如:重复拜访记录" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setInvalidTarget(null)} disabled={submitting}>
              取消
            </Button>
            <Button
              variant="danger"
              disabled={submitting || !reason.trim()}
              onClick={() => invalidTarget && evaluate(invalidTarget, "INVALID", reason.trim())}
            >
              {submitting ? "提交中…" : "确认标为无效"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
