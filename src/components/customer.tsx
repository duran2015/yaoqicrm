"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { TIER_OPTIONS } from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { CustomerStats, TierHistoryItem, ListResponse } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import { Button, Card, Dialog, Empty, Field, Loading, Select, Textarea, TierBadge } from "@/components/ui";

/** 合作代表文案:多个顿号分隔,无则 — */
export function assignmentsText(assignments?: { employee: { name: string } }[]): string {
  if (!assignments || assignments.length === 0) return "—";
  return assignments.map((a) => a.employee.name).join("、");
}

/** 顶部统计卡条:部门客户数量、我负责、未分级客户、A/B/C/D 级 */
export function CustomerStatsBar({ type }: { type: "hcp" | "hco" }) {
  const { current } = useUser();
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<CustomerStats>("/api/customers/stats", { type, employeeId: current?.id })
      .then((res) => {
        setStats(res);
        setLoading(false);
      })
      .catch(() => {
        setStats(null);
        setLoading(false);
      });
  }, [type, current?.id]);

  const items = [
    { label: "部门客户数量", value: stats?.total },
    { label: "我负责", value: stats?.mine },
    { label: "未分级客户", value: stats?.ungraded },
    { label: "A级", value: stats?.tierA },
    { label: "B级", value: stats?.tierB },
    { label: "C级", value: stats?.tierC },
    { label: "D级", value: stats?.tierD },
  ];

  return (
    <Card className="mb-4 grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3.5">
          <div className="text-xs text-slate-400">{item.label}</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">
            {loading ? <span className="text-slate-300">…</span> : (item.value ?? 0)}
          </div>
        </div>
      ))}
    </Card>
  );
}

/** 调整分级弹窗(选 A/B/C/D + 原因) */
export function TierAdjustDialog({
  open,
  onClose,
  kind,
  customerId,
  currentTier,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  kind: "hcp" | "hco";
  customerId: string;
  currentTier?: string | null;
  onDone: () => void;
}) {
  const { current } = useUser();
  const [toTier, setToTier] = useState(currentTier ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setToTier(currentTier ?? "");
      setReason("");
      setError(null);
    }
  }, [open, currentTier]);

  async function submit() {
    if (!current) return;
    if (!toTier) {
      setError("请选择目标分级");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/${kind}/${customerId}/tier`, {
        toTier,
        changedById: current.id,
        reason: reason || undefined,
      });
      onClose();
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "调整失败,请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="调整客户分级">
      <div className="space-y-4">
        <div className="text-sm text-slate-500">
          当前分级:<TierBadge tier={currentTier} />
        </div>
        <Field label="目标分级" required>
          <Select value={toTier} onChange={(e) => setToTier(e.target.value)}>
            <option value="">请选择</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t} 级
              </option>
            ))}
          </Select>
        </Field>
        <Field label="调整原因">
          <Textarea rows={3} placeholder="如:销量提升,升级重点客户" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "提交中…" : "确认调整"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** 客户分级面板:当前分级 + 变更历史时间线 + 调整按钮(hcp/hco 通用) */
export function TierPanel({
  kind,
  customerId,
  currentTier,
  onTierChanged,
}: {
  kind: "hcp" | "hco";
  customerId: string;
  currentTier?: string | null;
  onTierChanged?: () => void;
}) {
  const { employees } = useUser();
  const [history, setHistory] = useState<TierHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<ListResponse<TierHistoryItem>>(`/api/${kind}/${customerId}/tier-history`)
      .then((res) => {
        setHistory(res.data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [kind, customerId]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">当前客户分级:</span>
          <TierBadge tier={currentTier} />
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          调整分级
        </Button>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-700">分级变更历史</h3>
        {loading && <Loading text="正在加载变更历史…" />}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && !error && history.length === 0 && <Empty text="暂无分级变更记录" />}
        {!loading && !error && history.length > 0 && (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <TierBadge tier={h.fromTier} />
                  <span className="text-slate-400">→</span>
                  <TierBadge tier={h.toTier} />
                  <span className="text-xs text-slate-400">{fmtDateTime(h.changedAt)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  操作人:{employees.find((e) => e.id === h.changedById)?.name ?? h.changedById}
                  {h.reason ? ` · 原因:${h.reason}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <TierAdjustDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        kind={kind}
        customerId={customerId}
        currentTier={currentTier}
        onDone={() => {
          load();
          onTierChanged?.();
        }}
      />
    </div>
  );
}
