"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import type { InventoryProduct } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Skeleton } from "@/components/ui";

export default function SamplesPage() {
  const { current } = useUser();
  const [rows, setRows] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!current) return;
    setLoading(true);
    setError(null);
    apiGet<{ data: InventoryProduct[] }>("/api/samples/inventory", { employeeId: current.id })
      .then((res) => {
        setRows(res.data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [current]);

  useEffect(load, [load]);

  if (!current) return null;

  const lowStockCount = rows.filter((r) => r.current < 10).length;

  return (
    <div>
      <PageHeader
        title="样品库存"
        desc={`${current.name} 名下样品:当前库存 = 累计领用 − 累计发放`}
        extra={lowStockCount > 0 ? <Badge tone="red">{lowStockCount} 个产品库存不足 10 盒</Badge> : undefined}
      />

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
