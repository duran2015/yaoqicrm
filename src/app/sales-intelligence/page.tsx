"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/context";
import type { SalesIntelligence } from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button, Empty, ErrorBox, Input, Loading, PageHeader, Select, Tabs } from "@/components/ui";
import { SalesIntelligenceCard } from "@/components/sales-intelligence-card";
import { IntelligenceReviewDialog } from "@/components/intelligence-review-dialog";

type IntelligencePage = { items: SalesIntelligence[]; page: number; pageSize: number; total: number };
const tabs = [
  { key: "", label: "最新" },
  { key: "POLICY", label: "行业政策" },
  { key: "COMPETITOR", label: "竞品动态" },
  { key: "INDUSTRY_NEWS", label: "行业新闻" },
  { key: "KNOWLEDGE", label: "疾病与产品知识" },
  { key: "PENDING", label: "待核验" },
];

export default function SalesIntelligencePage() {
  const { current } = useUser();
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SalesIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [reviewItem, setReviewItem] = useState<SalesIntelligence | null>(null);
  const manager = current?.role !== "MR";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { query };
      if (active === "PENDING") params.status = "PENDING_REVIEW";
      else if (active !== "KNOWLEDGE" && active) params.type = active;
      const result = await apiGet<IntelligencePage>("/api/sales-intelligence", params);
      setItems(active === "KNOWLEDGE"
        ? result.items.filter((item) => item.type === "DISEASE_KNOWLEDGE" || item.type === "PRODUCT_KNOWLEDGE")
        : result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载销售情报失败");
    } finally {
      setLoading(false);
    }
  }, [active, query]);

  useEffect(() => { void load(); }, [load]);

  async function collectNow() {
    setCollecting(true);
    setError("");
    try {
      await apiPost("/api/intelligence-collection/runs", {
        triggerType: "MANUAL",
        requestedById: current?.id,
        confirmed: true,
        idempotencyKey: `manual-${current?.id ?? "demo"}-${Date.now()}`,
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "采集失败");
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="销售情报"
        desc="政策、竞品、行业动态与团队共享知识；所有内容保留来源和核验状态"
        extra={manager ? <Button disabled={collecting} onClick={collectNow}>{collecting ? "正在采集…" : "立即采集"}</Button> : null}
      />
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-slate-200">
        <span className="font-medium text-white">情报雷达</span>
        <span className="ml-2 text-slate-400">绿色为已核验事实，琥珀色为待核验线索；对外沟通仍以产品页批准材料为准。</span>
      </div>
      <Tabs tabs={tabs} active={active} onChange={setActive} />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索政策、产品、分子、竞品或疾病" />
        <Select value={active === "PENDING" ? "PENDING_REVIEW" : ""} onChange={(event) => setActive(event.target.value ? "PENDING" : "")}>
          <option value="">全部核验状态</option>
          <option value="PENDING_REVIEW">只看待核验</option>
        </Select>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载销售情报…" />}
      {!loading && !error && items.length === 0 && <Empty text="当前筛选下没有情报；管理员可以立即采集或调整来源。" />}
      {!loading && !error && (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <SalesIntelligenceCard
              key={item.id}
              item={item}
              actions={manager && item.verificationStatus === "PENDING_REVIEW"
                ? <Button size="sm" variant="outline" onClick={() => setReviewItem(item)}>核验内容</Button>
                : null}
            />
          ))}
        </div>
      )}
      <IntelligenceReviewDialog item={reviewItem} onClose={() => setReviewItem(null)} onSaved={load} />
    </div>
  );
}
