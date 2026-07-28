"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { ListResponse, Product } from "@/lib/types";
import { fmtCurrency, fmtDate } from "@/lib/utils";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<ListResponse<Product>>("/api/products")
      .then((res) => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const list = map.get(p.division) ?? [];
      list.push(p);
      map.set(p.division, list);
    }
    return [...map.entries()];
  }, [products]);

  return (
    <div>
      <PageHeader title="产品目录" desc="按事业部分组" />

      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载产品…" />}

      {!loading && !error && products.length === 0 && (
        <Card>
          <Empty text="暂无产品数据" />
        </Card>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {grouped.map(([division, list]) => (
            <section key={division}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                {division}
                <Badge tone="slate">{list.length} 个产品</Badge>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{p.brand}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{p.molecule}</div>
                      </div>
                      <Badge tone="emerald">{p.therapeuticCategory}</Badge>
                    </div>
                    <dl className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <dt className="text-slate-400">规格</dt>
                        <dd>{p.unit ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">价格</dt>
                        <dd className="font-medium text-slate-800">{fmtCurrency(p.price)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-400">样品批次</dt>
                        <dd>{p.sampleLots?.length ?? 0} 个</dd>
                      </div>
                    </dl>
                    {(p.sampleLots ?? []).length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        {(p.sampleLots ?? []).map((lot) => (
                          <div key={lot.id} className="flex justify-between py-0.5 text-xs text-slate-400">
                            <span>{lot.lotNumber}</span>
                            <span>效期 {fmtDate(lot.expiryDate)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
