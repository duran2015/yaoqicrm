"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { formatSalesAttainment, formatSalesMom, formatSalesMoney, salesScopeParams, type MonthOverMonth } from "@/lib/sales-results";
import { Card } from "@/components/ui";

type Summary = {
  targetAmountCents: number;
  actualAmountCents: number;
  attainment: number | null;
  monthOverMonth: MonthOverMonth;
};

export function SalesSummary({ employee, title }: { employee: { id: string; role: string }; title: string }) {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    apiGet<Summary>("/api/sales-results/summary", { month: "2026-07", ...salesScopeParams(employee) })
      .then(setData)
      .catch(() => setData(null));
  }, [employee]);
  if (!data) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <Link href="/sales-results" className="text-xs text-emerald-700 hover:underline">进入销售分析</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["目标金额", formatSalesMoney(data.targetAmountCents)],
          ["实际金额", formatSalesMoney(data.actualAmountCents)],
          ["达成率", formatSalesAttainment(data.attainment)],
          ["环比", formatSalesMom(data.monthOverMonth)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
