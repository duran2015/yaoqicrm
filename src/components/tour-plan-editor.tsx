"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import type { Hcp, ListResponse, TourPlan } from "@/lib/types";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";

type DraftItem = { planDate: string; hcpId: string; note: string };

export function TourPlanEditor({
  open,
  onClose,
  employeeId,
  weekStart,
  plan,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  weekStart: string;
  plan?: TourPlan | null;
  onSaved: () => void;
}) {
  const [hcps, setHcps] = useState<Hcp[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiGet<ListResponse<Hcp>>("/api/hcp", { pageSize: 200 })
      .then((res) => setHcps(res.data))
      .catch(() => setHcps([]));
    setItems(
      plan?.items.length
        ? plan.items.map((item) => ({
            planDate: item.planDate.slice(0, 10),
            hcpId: item.hcpId ?? item.hcp?.id ?? "",
            note: item.note ?? "",
          }))
        : [{ planDate: weekStart.slice(0, 10), hcpId: "", note: "" }]
    );
    setError(null);
  }, [open, plan, weekStart]);

  function changeItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function save() {
    const validItems = items.filter((item) => item.hcpId);
    if (!validItems.length) {
      setError("请至少添加一位计划拜访医生");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        employeeId,
        weekStart,
        items: validItems.map((item) => ({
          planDate: item.planDate,
          hcpId: item.hcpId,
          note: item.note || undefined,
        })),
      };
      if (plan) await apiPatch(`/api/tour-plans/${plan.id}`, payload);
      else await apiPost("/api/tour-plans", payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={plan ? "编辑周计划" : "创建周计划"} wide>
      <div className="space-y-4">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[150px_1fr_1fr_auto]">
              <Field label="日期">
                <Input type="date" value={item.planDate} onChange={(e) => changeItem(index, { planDate: e.target.value })} />
              </Field>
              <Field label="医生">
                <Select className="w-full" value={item.hcpId} onChange={(e) => changeItem(index, { hcpId: e.target.value })}>
                  <option value="">请选择医生</option>
                  {hcps.map((hcp) => <option key={hcp.id} value={hcp.id}>{hcp.name} · {hcp.hco?.name ?? "未关联机构"}</option>)}
                </Select>
              </Field>
              <Field label="计划备注">
                <Input value={item.note} onChange={(e) => changeItem(index, { note: e.target.value })} placeholder="沟通目标或准备事项" />
              </Field>
              <Button type="button" variant="ghost" className="self-end" onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>
                删除
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setItems((rows) => [...rows, { planDate: weekStart.slice(0, 10), hcpId: "", note: "" }])}>
            添加计划项
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
            <Button type="button" disabled={saving} onClick={save}>{saving ? "保存中…" : "保存草稿"}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
