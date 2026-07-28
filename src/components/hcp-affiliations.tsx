"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Hco, HcpAffiliationView } from "@/lib/types";
import { Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

type Draft = {
  hcoId: string;
  departmentName: string;
  title: string;
  adminDuty: string;
  isPrimary: boolean;
  effectiveDate: string;
  endDate: string;
};

function shanghaiDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function blankDraft(): Draft {
  return {
    hcoId: "",
    departmentName: "",
    title: "",
    adminDuty: "",
    isPrimary: false,
    effectiveDate: shanghaiDate(new Date()),
    endDate: "",
  };
}

function affiliationDraft(item: HcpAffiliationView): Draft {
  return {
    hcoId: item.hcoId,
    departmentName: item.departmentName,
    title: item.title ?? "",
    adminDuty: item.adminDuty ?? "",
    isPrimary: item.isPrimary,
    effectiveDate: shanghaiDate(item.effectiveDate),
    endDate: item.endDate ? shanghaiDate(item.endDate) : "",
  };
}

function statusBadge(item: HcpAffiliationView) {
  if (item.isPrimary && item.isCurrent) return <Badge tone="emerald">主要任职</Badge>;
  if (item.isCurrent) return <Badge tone="blue">当前任职</Badge>;
  if (new Date(item.effectiveDate) > new Date()) return <Badge tone="amber">未来任职</Badge>;
  return <Badge tone="slate">历史任职</Badge>;
}

export function HcpAffiliations({
  hcpId,
  affiliations,
  onChanged,
}: {
  hcpId: string;
  affiliations: HcpAffiliationView[];
  onChanged: () => void;
}) {
  const [hcos, setHcos] = useState<Hco[]>([]);
  const [editing, setEditing] = useState<HcpAffiliationView | null | "new">(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: Hco[] }>("/api/hco", { pageSize: 100 })
      .then((result) => setHcos(result.data))
      .catch(() => setHcos([]));
  }, []);

  function openNew() {
    setDraft({ ...blankDraft(), hcoId: hcos[0]?.id ?? "" });
    setError(null);
    setEditing("new");
  }

  function openEdit(item: HcpAffiliationView) {
    setDraft(affiliationDraft(item));
    setError(null);
    setEditing(item);
  }

  async function submit(nextDraft = draft, target = editing) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { ...nextDraft, endDate: nextDraft.endDate || null };
      if (target === "new") await apiPost(`/api/hcp/${hcpId}/affiliations`, payload);
      else await apiPatch(`/api/hcp/${hcpId}/affiliations/${target.id}`, payload);
      setEditing(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function promote(item: HcpAffiliationView) {
    setEditing(item);
    await submit({ ...affiliationDraft(item), isPrimary: true }, item);
  }

  async function end(item: HcpAffiliationView) {
    setEditing(item);
    await submit({ ...affiliationDraft(item), isPrimary: false, endDate: shanghaiDate(new Date()) }, item);
  }

  return (
    <>
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-medium text-slate-700">任职经历</h3>
            <p className="mt-0.5 text-xs text-slate-400">主要任职会同步到客户列表、拜访和会议等现有流程</p>
          </div>
          <Button size="sm" onClick={openNew}>+ 新增任职</Button>
        </div>
        {affiliations.length === 0 ? (
          <div className="py-5 text-center text-sm text-slate-400">暂无任职记录</div>
        ) : (
          <div className="space-y-2">
            {affiliations.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{item.hco.name}</span>
                      {statusBadge(item)}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {item.departmentName}
                      {item.title ? ` · ${item.title}` : ""}
                      {item.adminDuty ? ` · ${item.adminDuty}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {fmtDate(item.effectiveDate)} 至 {item.endDate ? fmtDate(item.endDate) : "至今"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {item.isCurrent && !item.isPrimary && <Button size="sm" variant="ghost" disabled={busy} onClick={() => promote(item)}>设为主要</Button>}
                    {item.isCurrent && <Button size="sm" variant="ghost" disabled={busy} onClick={() => end(item)}>结束任职</Button>}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => openEdit(item)}>编辑</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "新增任职" : "编辑任职"}>
        <div className="space-y-3">
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Field label="机构" required>
            <Select className="w-full" value={draft.hcoId} onChange={(event) => setDraft({ ...draft, hcoId: event.target.value })}>
              <option value="">请选择机构</option>
              {hcos.map((hco) => <option key={hco.id} value={hco.id}>{hco.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="科室名称" required><Input value={draft.departmentName} onChange={(event) => setDraft({ ...draft, departmentName: event.target.value })} /></Field>
            <Field label="职称"><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
            <Field label="行政职务"><Input value={draft.adminDuty} onChange={(event) => setDraft({ ...draft, adminDuty: event.target.value })} /></Field>
            <Field label="生效日期" required><Input type="date" value={draft.effectiveDate} onChange={(event) => setDraft({ ...draft, effectiveDate: event.target.value })} /></Field>
            <Field label="结束日期"><Input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={draft.isPrimary} onChange={(event) => setDraft({ ...draft, isPrimary: event.target.checked })} />
              设为主要任职
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>取消</Button>
            <Button disabled={busy || !draft.hcoId || !draft.departmentName || !draft.effectiveDate} onClick={() => submit()}>
              {busy ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
