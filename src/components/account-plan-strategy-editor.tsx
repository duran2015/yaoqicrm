"use client";

import { useEffect, useState } from "react";
import { apiPatch } from "@/lib/api-client";
import type { AccountPlan } from "@/lib/types";
import { Button, Dialog, Field, Textarea } from "@/components/ui";

export function AccountPlanStrategyEditor({
  plan,
  open,
  onClose,
  onSaved,
}: {
  plan: AccountPlan;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessGoal, setBusinessGoal] = useState(plan.businessGoal);
  const [situation, setSituation] = useState(plan.situation ?? "");
  const [strategy, setStrategy] = useState(plan.strategy);
  const [successCriteria, setSuccessCriteria] = useState(plan.successCriteria);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusinessGoal(plan.businessGoal);
    setSituation(plan.situation ?? "");
    setStrategy(plan.strategy);
    setSuccessCriteria(plan.successCriteria);
    setError(null);
  }, [open, plan]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/account-plans/${plan.id}/strategy`, {
        businessGoal,
        situation,
        strategy,
        successCriteria,
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="编辑客户策略" wide>
      <div className="space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Field label="业务目标" required><Textarea rows={3} value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value)} /></Field>
        <Field label="现状判断"><Textarea rows={3} value={situation} onChange={(event) => setSituation(event.target.value)} /></Field>
        <Field label="核心策略" required><Textarea rows={5} value={strategy} onChange={(event) => setStrategy(event.target.value)} /></Field>
        <Field label="成功标准" required><Textarea rows={3} value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button disabled={busy || !businessGoal.trim() || !strategy.trim() || !successCriteria.trim()} onClick={save}>
            {busy ? "保存中…" : "保存策略"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
