"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { InventoryProduct } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Skeleton } from "@/components/ui";

interface LotOption {
  id: string;
  lotNumber: string;
  expiryDate: string;
  product: { id: string; brand: string; molecule: string };
}

interface TransactionRow {
  id: string;
  type: string;
  quantity: number;
  reason?: string | null;
  confirmedByHcp: boolean;
  transDate: string;
  lot: LotOption;
  hcp?: { id: string; name: string } | null;
}

export default function SamplesPage() {
  const { current } = useUser();
  const [rows, setRows] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState("RECEIVE");
  const [lotId, setLotId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<{ data: InventoryProduct[] }>("/api/samples/inventory", { employeeId: current.id }),
      apiGet<{ data: TransactionRow[] }>("/api/samples/transactions", { employeeId: current.id }),
      apiGet<{ data: LotOption[] }>("/api/samples/lots"),
    ])
      .then(([inventory, txns, lotRows]) => {
        setRows(inventory.data);
        setTransactions(txns.data);
        setLots(lotRows.data);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, [current]);

  useEffect(load, [load]);

  if (!current) return null;

  const lowStockCount = rows.filter((r) => r.current < 10).length;
  const currentLotStock = rows.flatMap((row) => row.lots).find((lot) => lot.lotId === lotId)?.current ?? 0;

  async function submitOperation() {
    if (!current) return;
    const entered = Number(quantity);
    const transactionQuantity = type === "ADJUST" ? entered - currentLotStock : entered;
    try {
      await apiPost("/api/samples/transactions", {
        employeeId: current.id,
        lotId,
        type,
        quantity: transactionQuantity,
        reason: reason || (type === "ADJUST" ? `盘点实存 ${entered} 盒` : undefined),
      });
      setDialogOpen(false);
      setNotice("样品库存操作已记录");
      setLotId(""); setQuantity(""); setReason("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "操作失败");
    }
  }

  return (
    <div>
      <PageHeader
        title="样品库存"
        desc={`${current.name} 名下样品:当前库存 = 累计领用 − 累计发放`}
        extra={
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && <Badge tone="red">{lowStockCount} 个产品库存不足 10 盒</Badge>}
            <Button onClick={() => setDialogOpen(true)}>库存操作</Button>
          </div>
        }
      />

      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && (
        <Card className="p-5">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <Loading />
        </Card>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <Empty text="当前身份暂无样品库存记录" />
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">产品 / 批次</th>
                <th className="px-4 py-3 font-medium">批次号</th>
                <th className="px-4 py-3 font-medium">有效期至</th>
                <th className="px-4 py-3 text-right font-medium">领用</th>
                <th className="px-4 py-3 text-right font-medium">发放</th>
                <th className="px-4 py-3 text-right font-medium">当前库存</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <ProductRows key={p.product.id} item={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">库存流水</h2>
          {!transactions.length ? <Card><Empty text="暂无库存流水" /></Card> : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-slate-100">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[100px_1fr_100px_160px]">
                    <Badge tone={transaction.type === "RECEIVE" ? "emerald" : transaction.type === "DISTRIBUTE" ? "blue" : transaction.type === "RETURN" ? "amber" : "slate"}>
                      {transaction.type === "RECEIVE" ? "领用" : transaction.type === "DISTRIBUTE" ? "发放" : transaction.type === "RETURN" ? "退回" : "盘点调整"}
                    </Badge>
                    <span>{transaction.lot.product.brand} · {transaction.lot.lotNumber}{transaction.hcp ? ` · ${transaction.hcp.name}` : ""}</span>
                    <span className={transaction.type === "RECEIVE" || transaction.type === "ADJUST" && transaction.quantity > 0 ? "text-emerald-700" : "text-red-600"}>
                      {transaction.type === "RECEIVE" || transaction.type === "ADJUST" && transaction.quantity > 0 ? "+" : "-"}{Math.abs(transaction.quantity)}
                    </span>
                    <span className="text-xs text-slate-400">{fmtDate(transaction.transDate)}{transaction.reason ? ` · ${transaction.reason}` : ""}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="样品库存操作">
        <div className="space-y-4">
          <Field label="操作类型" required>
            <Select className="w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="RECEIVE">领用入库</option>
              <option value="RETURN">退回</option>
              <option value="ADJUST">盘点</option>
            </Select>
          </Field>
          <Field label="产品批次" required>
            <Select className="w-full" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">请选择批次</option>
              {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.product.brand} · {lot.lotNumber} · 效期 {fmtDate(lot.expiryDate)}</option>)}
            </Select>
          </Field>
          {lotId && <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">当前批次库存：{currentLotStock} 盒</div>}
          <Field label={type === "ADJUST" ? "盘点实存数量" : "数量"} required>
            <Input type="number" min={type === "ADJUST" ? 0 : 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="原因"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "ADJUST" ? "可选，默认记录实存数量" : "领用单号或退回原因"} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button disabled={!lotId || quantity === "" || (type !== "ADJUST" && Number(quantity) <= 0) || (type === "ADJUST" && Number(quantity) === currentLotStock)} onClick={submitOperation}>
              确认并记录
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ProductRows({ item }: { item: InventoryProduct }) {
  const low = item.current < 10;
  return (
    <>
      <tr className="bg-slate-50/70">
        <td className="px-4 py-2.5 font-medium text-slate-800">
          {item.product.brand}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {item.product.molecule}
            {item.product.unit ? ` · ${item.product.unit}` : ""}
          </span>
        </td>
        <td className="px-4 py-2.5 text-xs text-slate-400">产品合计</td>
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5 text-right text-slate-600">{item.received}</td>
        <td className="px-4 py-2.5 text-right text-slate-600">{item.distributed}</td>
        <td className={`px-4 py-2.5 text-right font-semibold ${low ? "text-red-600" : "text-emerald-700"}`}>
          {item.current}
          {low && (
            <Badge tone="red" className="ml-2">
              库存不足
            </Badge>
          )}
        </td>
      </tr>
      {item.lots.map((lot) => (
        <tr key={lot.lotId} className="hover:bg-slate-50">
          <td className="px-4 py-2.5 pl-8 text-slate-500">└ 批次</td>
          <td className="px-4 py-2.5 text-slate-600">{lot.lotNumber}</td>
          <td className="px-4 py-2.5 text-slate-600">{fmtDate(lot.expiryDate)}</td>
          <td className="px-4 py-2.5 text-right text-slate-600">{lot.received}</td>
          <td className="px-4 py-2.5 text-right text-slate-600">{lot.distributed}</td>
          <td className={`px-4 py-2.5 text-right font-medium ${lot.current < 10 ? "text-red-600" : "text-slate-800"}`}>
            {lot.current}
          </td>
        </tr>
      ))}
    </>
  );
}
