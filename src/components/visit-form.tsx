"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { PURPOSE_OPTIONS, VISIT_TYPE_LABELS } from "@/lib/constants";
import type { Hcp, InventoryProduct, ListResponse, Product, Visit } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { Badge, Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { useUser } from "@/lib/context";

interface SampleRow {
  lotId: string;
  quantity: string;
  confirmedByHcp: boolean;
}

interface VisitBrief {
  recentVisits: { id: string; visitDate: string; outcome?: string | null; summary?: string | null; nextStep?: string | null }[];
  openTasks: { id: string; title: string; dueDate?: string | null; priority: string }[];
  sampleSummary: { product: { id: string; brand: string }; quantity: number }[];
}

interface VisitFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** 从医生详情页打开时预选医生 */
  preselectedHcp?: { id: string; name: string } | null;
  tourPlanItemId?: string | null;
  plannedDate?: string | null;
  onSuccess?: (visit: Visit) => void;
}

export function VisitFormDialog({
  open,
  onClose,
  preselectedHcp,
  tourPlanItemId,
  plannedDate,
  onSuccess,
}: VisitFormDialogProps) {
  const { current, employees } = useUser();

  // 医生搜索 combobox
  const [hcpQuery, setHcpQuery] = useState("");
  const [hcpOptions, setHcpOptions] = useState<Hcp[]>([]);
  const [hcpLoading, setHcpLoading] = useState(false);
  const [selectedHcp, setSelectedHcp] = useState<Hcp | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 表单字段
  const [type, setType] = useState("FACE_TO_FACE");
  const [purpose, setPurpose] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState("NORMAL");
  const [brief, setBrief] = useState<VisitBrief | null>(null);
  const [receiverId, setReceiverId] = useState("");
  const [checkinLocation, setCheckinLocation] = useState("");
  const [withCheckin, setWithCheckin] = useState(true);

  // 产品与反馈
  const [products, setProducts] = useState<Product[]>([]);
  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  // 样品与库存
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [sampleRows, setSampleRows] = useState<SampleRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时初始化
  useEffect(() => {
    if (!open) return;
    setType("FACE_TO_FACE");
    setPurpose("");
    setPurposes([]);
    setOutcome("");
    setDuration("");
    setNotes("");
    setSummary("");
    setNextStep("");
    setCreateTask(true);
    setFollowUpDueDate("");
    setFollowUpPriority("NORMAL");
    setBrief(null);
    setReceiverId("");
    setCheckinLocation("");
    setWithCheckin(true);
    setCheckedProducts({});
    setFeedbacks({});
    setSampleRows([]);
    setError(null);
    setHcpQuery("");
    setHcpOptions([]);
    setSelectedHcp(null);

    // 预选医生:拉取完整信息
    if (preselectedHcp) {
      apiGet<ListResponse<Hcp>>("/api/hcp", { query: preselectedHcp.name })
        .then((res) => {
          const found = res.data.find((h) => h.id === preselectedHcp.id);
          if (found) setSelectedHcp(found);
          else setSelectedHcp({ id: preselectedHcp.id, name: preselectedHcp.name, tier: "" } as Hcp);
        })
        .catch(() => setSelectedHcp({ id: preselectedHcp.id, name: preselectedHcp.name, tier: "" } as Hcp));
    }

    apiGet<ListResponse<Product>>("/api/products")
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
  }, [open, preselectedHcp]);

  useEffect(() => {
    if (!open || !current) return;
    apiGet<{ data: InventoryProduct[] }>("/api/samples/inventory", { employeeId: current.id })
      .then((res) => setInventory(res.data))
      .catch(() => setInventory([]));
  }, [open, current]);

  useEffect(() => {
    if (!open || !current || !selectedHcp) {
      setBrief(null);
      return;
    }
    apiGet<VisitBrief>("/api/visit-brief", { hcpId: selectedHcp.id, employeeId: current.id })
      .then(setBrief)
      .catch(() => setBrief(null));
  }, [open, current, selectedHcp]);

  // 医生搜索(防抖)
  const onHcpQueryChange = useCallback((value: string) => {
    setHcpQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setHcpLoading(true);
      apiGet<ListResponse<Hcp>>("/api/hcp", { query: value })
        .then((res) => {
          setHcpOptions(res.data.slice(0, 8));
          setDropdownOpen(true);
        })
        .catch(() => setHcpOptions([]))
        .finally(() => setHcpLoading(false));
    }, 300);
  }, []);

  // 可选批次:来自产品的 sampleLots,附带该产品当前库存
  const lotOptions = useMemo(() => {
    const stockByProduct = new Map(inventory.map((p) => [p.product.id, p.current]));
    const options: { lotId: string; label: string; stock: number }[] = [];
    for (const p of products) {
      for (const lot of p.sampleLots ?? []) {
        const stock = stockByProduct.get(p.id) ?? 0;
        options.push({
          lotId: lot.id,
          label: `${p.brand}(${p.molecule})| ${lot.lotNumber} | 效期 ${fmtDate(lot.expiryDate)} | 当前库存 ${stock} 盒`,
          stock,
        });
      }
    }
    return options;
  }, [products, inventory]);

  function updateSampleRow(index: number, patch: Partial<SampleRow>) {
    setSampleRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSubmit() {
    if (!current) return;
    setError(null);
    if (!selectedHcp) {
      setError("请选择拜访医生");
      return;
    }
    const durationNum = duration ? Number(duration) : undefined;
    if (duration && (!Number.isInteger(durationNum) || (durationNum ?? 0) <= 0)) {
      setError("时长必须为正整数(分钟)");
      return;
    }
    const samples: { lotId: string; quantity: number; confirmedByHcp: boolean }[] = [];
    for (const row of sampleRows) {
      if (!row.lotId) {
        setError("请选择样品批次");
        return;
      }
      const qty = Number(row.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError("样品数量必须为正整数");
        return;
      }
      samples.push({ lotId: row.lotId, quantity: qty, confirmedByHcp: row.confirmedByHcp });
    }

    setSubmitting(true);
    try {
      const visit = await apiPost<Visit>("/api/visits", {
        employeeId: current.id,
        tourPlanItemId: tourPlanItemId || undefined,
        visitDate: plannedDate || undefined,
        status: "SUBMITTED",
        hcpId: selectedHcp.id,
        hcoId: selectedHcp.hco?.id ?? undefined,
        type,
        purpose: purpose || undefined,
        purposes: purposes.length ? purposes : undefined,
        outcome: outcome || undefined,
        duration: durationNum,
        notes: notes || undefined,
        summary: summary || undefined,
        nextStep: nextStep || undefined,
        followUp: createTask && nextStep
          ? {
              title: nextStep,
              dueDate: followUpDueDate || undefined,
              priority: followUpPriority,
            }
          : undefined,
        receiverId: receiverId || undefined,
        checkins: withCheckin
          ? [{ locationName: checkinLocation || selectedHcp.hco?.name || undefined }]
          : undefined,
        products: products
          .filter((p) => checkedProducts[p.id])
          .map((p) => ({ productId: p.id, feedback: feedbacks[p.id]?.trim() || undefined })),
        samples,
      });
      onSuccess?.(visit);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError("提交失败,请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="记录拜访" wide>
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* 医生选择 */}
        <Field label="拜访医生" required>
          {selectedHcp ? (
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="text-sm text-emerald-800">
                {selectedHcp.name}
                {selectedHcp.title && <span className="ml-1 text-emerald-600">{selectedHcp.title}</span>}
                {selectedHcp.hco?.name && <span className="ml-2 text-xs text-emerald-600">{selectedHcp.hco.name}</span>}
              </span>
              <button className="text-xs text-emerald-600 hover:text-emerald-800" onClick={() => setSelectedHcp(null)}>
                重新选择
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="输入医生姓名搜索…"
                value={hcpQuery}
                onChange={(e) => onHcpQueryChange(e.target.value)}
                onFocus={() => hcpOptions.length > 0 && setDropdownOpen(true)}
              />
              {dropdownOpen && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {hcpLoading && <div className="px-3 py-2 text-sm text-slate-400">搜索中…</div>}
                  {!hcpLoading && hcpOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">未找到匹配的医生</div>
                  )}
                  {hcpOptions.map((h) => (
                    <button
                      key={h.id}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                      onClick={() => {
                        setSelectedHcp(h);
                        setDropdownOpen(false);
                      }}
                    >
                      <span>
                        {h.name}
                        <span className="ml-1 text-slate-400">{h.title}</span>
                      </span>
                      <span className="text-xs text-slate-400">{h.hco?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        {selectedHcp && brief && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="mb-2 text-sm font-medium text-blue-900">拜访前简报</div>
            <div className="grid gap-3 text-xs text-slate-600 md:grid-cols-3">
              <div>
                <div className="mb-1 font-medium text-slate-700">最近沟通</div>
                {brief.recentVisits.slice(0, 2).map((visit) => (
                  <div key={visit.id} className="mb-1">{fmtDate(visit.visitDate)} · {visit.outcome || visit.summary || "未记录结果"}</div>
                ))}
                {!brief.recentVisits.length && <div>暂无历史拜访</div>}
              </div>
              <div>
                <div className="mb-1 font-medium text-slate-700">未完成任务</div>
                {brief.openTasks.slice(0, 3).map((task) => <div key={task.id}>{task.title}{task.dueDate ? ` · ${fmtDate(task.dueDate)}` : ""}</div>)}
                {!brief.openTasks.length && <div>暂无待跟进事项</div>}
              </div>
              <div>
                <div className="mb-1 font-medium text-slate-700">样品历史</div>
                {brief.sampleSummary.map((sample) => <div key={sample.product.id}>{sample.product.brand} × {sample.quantity}</div>)}
                {!brief.sampleSummary.length && <div>暂无发放记录</div>}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="拜访类型">
            <Select className="w-full" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="时长(分钟)">
            <Input type="number" min={1} placeholder="如 30" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label="拜访结果">
            <Input placeholder="如:同意试用" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
          <Field label="接收人(报告上级)">
            <Select className="w-full" value={receiverId} onChange={(e) => setReceiverId(e.target.value)}>
              <option value="">直属上级(默认)</option>
              {employees
                .filter((e) => e.id !== current?.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.employeeCode ? `(${e.employeeCode})` : ""}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        {/* 拜访目的:结构化多选 */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">拜访目的(可多选)</span>
          <div className="flex flex-wrap gap-2">
            {PURPOSE_OPTIONS.map((p) => {
              const active = purposes.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurposes((list) => (active ? list.filter((x) => x !== p) : [...list, p]))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          {purposes.includes("其他") && (
            <Input
              className="mt-2"
              placeholder="其他目的说明(可选,写入旧 purpose 字段)"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          )}
        </div>

        <Field label="拜访记录">
          <Textarea
            rows={4}
            placeholder="口语化速记即可,AI 会帮你整理"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <Field label="拜访总结">
          <Textarea
            rows={3}
            placeholder="一句话总结本次拜访的达成情况(人工总结,与 AI 摘要独立保存)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>

        {/* 签到 */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">签到</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-emerald-600"
                checked={withCheckin}
                onChange={(e) => setWithCheckin(e.target.checked)}
              />
              提交时同时签到(时间=当前)
            </label>
          </div>
          {withCheckin && (
            <Input
              placeholder={`签到地点(默认:${selectedHcp?.hco?.name ?? "医生所属机构"})`}
              value={checkinLocation}
              onChange={(e) => setCheckinLocation(e.target.value)}
            />
          )}
        </div>

        <Field label="下一步计划">
          <Input placeholder="如:下周三带最新文献回访" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
        </Field>
        {nextStep && (
          <div className="grid gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-3 md:grid-cols-[1fr_180px_160px]">
            <label className="flex items-center gap-2 text-sm text-emerald-800">
              <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
              同时生成可追踪的后续任务
            </label>
            <Field label="截止日期">
              <Input type="date" value={followUpDueDate} onChange={(e) => setFollowUpDueDate(e.target.value)} disabled={!createTask} />
            </Field>
            <Field label="优先级">
              <Select value={followUpPriority} onChange={(e) => setFollowUpPriority(e.target.value)} disabled={!createTask}>
                <option value="NORMAL">普通</option>
                <option value="HIGH">高</option>
              </Select>
            </Field>
          </div>
        )}

        {/* 讨论产品 */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">讨论产品(可多选,可填医生反馈)</span>
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <label className="flex w-52 shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={!!checkedProducts[p.id]}
                    onChange={(e) => setCheckedProducts((m) => ({ ...m, [p.id]: e.target.checked }))}
                  />
                  {p.brand}
                  <span className="text-xs text-slate-400">{p.molecule}</span>
                </label>
                {checkedProducts[p.id] && (
                  <Input
                    placeholder="医生反馈(可选)"
                    value={feedbacks[p.id] ?? ""}
                    onChange={(e) => setFeedbacks((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            {products.length === 0 && <div className="text-sm text-slate-400">产品列表加载中…</div>}
          </div>
        </div>

        {/* 样品发放 */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">发放样品(显示当前库存)</span>
            <Button variant="outline" size="sm" onClick={() => setSampleRows((rows) => [...rows, { lotId: "", quantity: "", confirmedByHcp: false }])}>
              + 添加样品
            </Button>
          </div>
          {sampleRows.length > 0 && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              {sampleRows.map((row, i) => {
                const lot = lotOptions.find((o) => o.lotId === row.lotId);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Select className="flex-1" value={row.lotId} onChange={(e) => updateSampleRow(i, { lotId: e.target.value })}>
                      <option value="">选择批次…</option>
                      {lotOptions.map((o) => (
                        <option key={o.lotId} value={o.lotId}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="w-24"
                      type="number"
                      min={1}
                      placeholder="数量"
                      value={row.quantity}
                      onChange={(e) => updateSampleRow(i, { quantity: e.target.value })}
                    />
                    <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" checked={row.confirmedByHcp} onChange={(e) => updateSampleRow(i, { confirmedByHcp: e.target.checked })} />
                      已确认签收
                    </label>
                    {lot && (
                      <Badge tone={lot.stock < 10 ? "red" : "emerald"}>库存 {lot.stock}</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setSampleRows((rows) => rows.filter((_, j) => j !== i))}>
                      删除
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中…" : "提交拜访"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
