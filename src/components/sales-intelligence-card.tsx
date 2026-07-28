"use client";

import type { SalesIntelligence } from "@/lib/types";
import { Badge, Card } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  POLICY: "行业政策",
  COMPETITOR: "竞品动态",
  INDUSTRY_NEWS: "行业新闻",
  DISEASE_KNOWLEDGE: "疾病知识",
  PRODUCT_KNOWLEDGE: "产品知识",
};

export function SalesIntelligenceCard({
  item,
  actions,
}: {
  item: SalesIntelligence;
  actions?: React.ReactNode;
}) {
  const verified = item.verificationStatus === "VERIFIED";
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${verified ? "bg-emerald-500" : "bg-amber-400"}`} />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{TYPE_LABELS[item.type] ?? item.type}</Badge>
          <Badge tone={verified ? "emerald" : "amber"}>{verified ? "已核验" : "待核验"}</Badge>
          <span className="text-[11px] font-medium tracking-wide text-slate-400">内部参考</span>
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-900">{item.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{item.summary}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(item.products ?? []).map(({ product }) => <Badge key={product.id} tone="teal">{product.brand}</Badge>)}
          {(item.therapeuticAreas ?? []).map((area) => <Badge key={area.name}>{area.name}</Badge>)}
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a className="font-medium text-emerald-700 hover:underline" href={item.sourceUrl} target="_blank" rel="noreferrer">
              {item.sourceName} ↗
            </a>
            <span>{item.publishedAt ? `发布 ${fmtDate(item.publishedAt)}` : `采集 ${fmtDate(item.collectedAt)}`}</span>
          </div>
        </div>
        {actions && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">{actions}</div>}
      </div>
    </Card>
  );
}
