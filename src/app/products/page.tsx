"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";
import type { ListResponse, Product } from "@/lib/types";
import { fmtCurrency, fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { ProductMaterialEditor } from "@/components/product-material-editor";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState("");

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
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">合规资料</span><Button size="sm" variant="ghost" onClick={() => setEditingProductId(p.id)}>新建版本</Button></div>
                      <div className="space-y-2">{(p.materials ?? []).map((material) => {
                        const active = material.status === "APPROVED" && new Date(material.effectiveDate) <= new Date("2026-07-24T00:00:00+08:00") && new Date(material.expiryDate) > new Date("2026-07-24T00:00:00+08:00");
                        return <div key={material.id} className="rounded bg-slate-50 p-2 text-xs"><div className="flex items-center justify-between"><a href={material.externalUrl} target="_blank" className="font-medium text-emerald-700">{material.title} · {material.version}</a><Badge tone={active ? "emerald" : material.status === "DRAFT" ? "amber" : "slate"}>{active ? "当前有效" : material.status === "DRAFT" ? "草稿" : "已停用"}</Badge></div><div className="mt-1 text-slate-500">{material.messageSummary}</div><div className="mt-1 flex justify-between text-slate-400"><span>{material.approvalCode ?? "未批准"}</span><span>{fmtDate(material.effectiveDate)}—{fmtDate(material.expiryDate)}</span></div>{material.status === "DRAFT"&&<div className="mt-2 flex gap-2"><Button size="sm" onClick={async()=>{await apiPatch(`/api/product-materials/${material.id}`,{status:"APPROVED"});load();}}>批准</Button><Button size="sm" variant="ghost" onClick={async()=>{await apiPatch(`/api/product-materials/${material.id}`,{status:"RETIRED"});load();}}>停用</Button></div>}{material.status === "APPROVED"&&<Button className="mt-2" size="sm" variant="ghost" onClick={async()=>{await apiPatch(`/api/product-materials/${material.id}`,{status:"RETIRED"});load();}}>停用</Button>}</div>;
                      })}{!(p.materials ?? []).length&&<div className="text-xs text-slate-400">暂无资料版本</div>}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <ProductMaterialEditor productId={editingProductId} open={Boolean(editingProductId)} onClose={() => setEditingProductId("")} onSaved={load} />
    </div>
  );
}
