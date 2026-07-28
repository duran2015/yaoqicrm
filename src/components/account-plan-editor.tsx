"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import type { AccountPlan, Hco, Hcp, ListResponse, Product } from "@/lib/types";
import type { FlatEmployee } from "@/lib/context";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";

type StakeholderDraft = { hcpId: string; decisionRole: string; attitude: string; notes: string };
type MilestoneDraft = { title: string; description: string; ownerId: string; dueDate: string };

export function AccountPlanEditor({
  open,
  onClose,
  employees,
  currentId,
  initialHcoId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  employees: FlatEmployee[];
  currentId: string;
  initialHcoId?: string;
  onSaved: (plan: AccountPlan) => void;
}) {
  const [hcos, setHcos] = useState<Hco[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hcps, setHcps] = useState<Hcp[]>([]);
  const [hcoId, setHcoId] = useState("");
  const [year, setYear] = useState(2026);
  const [ownerId, setOwnerId] = useState(currentId);
  const [businessGoal, setBusinessGoal] = useState("");
  const [situation, setSituation] = useState("");
  const [strategy, setStrategy] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderDraft[]>([]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiGet<ListResponse<Hco>>("/api/hco", { pageSize: 100 }),
      apiGet<ListResponse<Product>>("/api/products"),
    ]).then(([hcoResponse, productResponse]) => {
      const strategic = hcoResponse.data.filter((hco) => hco.isStrategic === "是");
      setHcos(strategic);
      setProducts(productResponse.data);
      setHcoId(initialHcoId && strategic.some((hco) => hco.id === initialHcoId) ? initialHcoId : strategic[0]?.id ?? "");
    }).catch(() => setError("加载客户或产品失败"));
    setOwnerId(currentId);
    setError(null);
  }, [open, currentId, initialHcoId]);

  useEffect(() => {
    if (!open || !hcoId) return;
    apiGet<ListResponse<Hcp>>("/api/hcp", { hcoId, pageSize: 100 })
      .then((response) => { setHcps(response.data); setStakeholders([]); })
      .catch(() => setHcps([]));
  }, [open, hcoId]);

  function toggleProduct(productId: string) {
    setProductIds((ids) => ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]);
  }

  function toggleStakeholder(hcpId: string) {
    setStakeholders((items) => items.some((item) => item.hcpId === hcpId)
      ? items.filter((item) => item.hcpId !== hcpId)
      : [...items, { hcpId, decisionRole: "INFLUENCER", attitude: "NEUTRAL", notes: "" }]);
  }

  function updateStakeholder(hcpId: string, patch: Partial<StakeholderDraft>) {
    setStakeholders((items) => items.map((item) => item.hcpId === hcpId ? { ...item, ...patch } : item));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const plan = await apiPost<AccountPlan>("/api/account-plans", {
        hcoId, year, ownerId, createdById: currentId, businessGoal, situation, strategy, successCriteria,
        productIds,
        stakeholders,
        milestones,
      });
      onSaved(plan);
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="创建 Account Plan" wide>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="战略 HCO" required><Select className="w-full" value={hcoId} onChange={(event) => setHcoId(event.target.value)}>{hcos.map((hco) => <option key={hco.id} value={hco.id}>{hco.name}</option>)}</Select></Field>
          <Field label="年度" required><Input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></Field>
          <Field label="计划负责人" required><Select className="w-full" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="业务目标" required><Textarea value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} /></Field>
          <Field label="现状判断"><Textarea value={situation} onChange={(event) => setSituation(event.target.value)} /></Field>
          <Field label="核心策略" required><Textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} /></Field>
          <Field label="成功标准" required><Textarea value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} /></Field>
        </div>
        <Field label="重点产品" required>
          <div className="grid gap-2 md:grid-cols-3">{products.map((product) => <label key={product.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm"><input type="checkbox" checked={productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />{product.brand} · {product.molecule}</label>)}</div>
        </Field>
        <Field label="关键关系人">
          <div className="space-y-2">
            {hcps.map((hcp) => {
              const draft = stakeholders.find((item) => item.hcpId === hcp.id);
              return (
                <div key={hcp.id} className="grid items-center gap-2 rounded border border-slate-200 p-2 md:grid-cols-[180px_1fr_1fr]">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(draft)} onChange={() => toggleStakeholder(hcp.id)} />{hcp.name} · {hcp.title}</label>
                  {draft && <Select value={draft.decisionRole} onChange={(event) => updateStakeholder(hcp.id, { decisionRole: event.target.value })}><option value="DECISION_MAKER">决策者</option><option value="INFLUENCER">影响者</option><option value="SUPPORTER">支持者</option></Select>}
                  {draft && <Select value={draft.attitude} onChange={(event) => updateStakeholder(hcp.id, { attitude: event.target.value })}><option value="ADVOCATE">强力支持</option><option value="SUPPORTIVE">支持</option><option value="NEUTRAL">中立</option><option value="OPPOSED">反对</option></Select>}
                </div>
              );
            })}
          </div>
        </Field>
        <Field label="初始里程碑">
          <div className="space-y-2">{milestones.map((item, index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_160px_160px_auto]"><Input placeholder="里程碑标题" value={item.title} onChange={(event) => setMilestones((rows) => rows.map((row, i) => i === index ? { ...row, title: event.target.value } : row))} /><Select value={item.ownerId} onChange={(event) => setMilestones((rows) => rows.map((row, i) => i === index ? { ...row, ownerId: event.target.value } : row))}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select><Input type="date" value={item.dueDate} onChange={(event) => setMilestones((rows) => rows.map((row, i) => i === index ? { ...row, dueDate: event.target.value } : row))} /><Button variant="ghost" onClick={() => setMilestones((rows) => rows.filter((_, i) => i !== index))}>删除</Button></div>)}</div>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => setMilestones((rows) => [...rows, { title: "", description: "", ownerId, dueDate: "2026-08-15" }])}>添加里程碑</Button>
        </Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={saving} onClick={save}>{saving ? "创建中…" : "创建计划"}</Button></div>
      </div>
    </Dialog>
  );
}
