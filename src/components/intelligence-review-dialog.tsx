"use client";

import { useState } from "react";
import type { SalesIntelligence } from "@/lib/types";
import { apiPost } from "@/lib/api-client";
import { Button, Dialog, Textarea } from "@/components/ui";

export function IntelligenceReviewDialog({
  item,
  onClose,
  onSaved,
}: {
  item: SalesIntelligence | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review(status: "VERIFIED" | "REJECTED") {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      await apiPost(`/api/sales-intelligence/${item.id}/review`, { status, reviewNote: note });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "核验失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onClose={onClose} title="核验销售情报">
      <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="font-medium">{item?.title}</div>
        <div className="mt-1 text-xs">核对原文后再通过。通过不等于批准为对外销售话术。</div>
      </div>
      <Textarea className="mt-4" rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录核验依据或驳回原因" />
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="danger" disabled={busy} onClick={() => review("REJECTED")}>驳回</Button>
        <Button disabled={busy} onClick={() => review("VERIFIED")}>核验通过</Button>
      </div>
    </Dialog>
  );
}
