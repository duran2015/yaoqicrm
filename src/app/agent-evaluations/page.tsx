"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import { isManagerRole } from "@/lib/constants";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

type Assertion = { id: string; label: string; required: boolean; passed: boolean; expected: string; actual: string };
type Result = { id: string; caseKey: string; caseName: string; capability: string; status: string; latencyMs?: number; errorMessage?: string; assertions: Assertion[] };
type Run = { id: string; status: string; startedAt: string; completedAt?: string; caseCount: number; passedCaseCount: number; assertionCount: number; passedAssertionCount: number; averageLatencyMs?: number; results?: Result[] };
type Summary = {
  latest: Run | null;
  capabilities: { capability: string; caseCount: number; passedCaseCount: number; assertionCount: number; passedAssertionCount: number }[];
  failures: { caseKey: string; caseName: string; label: string; expected: string; actual: string }[];
  recentPassRate: number;
  runs: Run[];
};
const CAPABILITY_LABELS: Record<string, string> = {
  PROTOCOL: "MCP 协议", IDENTITY: "身份隔离", INTELLIGENCE_SEARCH: "情报搜索",
  PRODUCT_BATTLECARD: "产品战卡", INTELLIGENCE_REFRESH: "刷新与审计",
};

export default function AgentEvaluationsPage() {
  const { current } = useUser();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    apiGet<Summary>("/api/agent-evaluations/summary").then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败")).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function run(caseKey?: string) {
    if (!current) return;
    setRunning(true); setError(null);
    try { await apiPost("/api/agent-evaluations/runs", { employeeId: current.id, caseKey }); load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "评测运行失败"); }
    finally { setRunning(false); }
  }

  if (!current) return null;
  if (!isManagerRole(current.role)) return <><PageHeader title="Agent 评测" /><Card><Empty text="请切换到经理或管理员身份运行评测" /></Card></>;
  const latest = data?.latest;
  const passRate = latest?.assertionCount ? Math.round(latest.passedAssertionCount / latest.assertionCount * 100) : 0;
  return (
    <div>
      <PageHeader title="Agent 评测" desc="真实调用 MCP，以确定性断言验证身份、情报、战卡、幂等与审计"
        extra={<Button disabled={running} onClick={() => run()}>{running ? "正在运行…" : "运行全部评测"}</Button>} />
      {error && <ErrorBox message={error} onRetry={load} />}
      {loading && <Loading text="正在加载评测证据…" />}
      {!loading && data && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["总体通过率", `${passRate}%`],
              ["通过场景", latest ? `${latest.passedCaseCount}/${latest.caseCount}` : "—"],
              ["平均延迟", latest?.averageLatencyMs != null ? `${latest.averageLatencyMs} ms` : "—"],
              ["近十轮全绿", `${data.recentPassRate}%`],
            ].map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></Card>)}
          </div>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h3 className="font-medium text-slate-900">最近一轮证据链</h3><p className="mt-1 text-xs text-slate-500">{latest ? fmtDateTime(latest.startedAt) : "尚未运行"}</p></div>
              {latest && <Badge tone={latest.status === "PASSED" ? "emerald" : "red"}>{latest.status === "PASSED" ? "全部通过" : "存在失败"}</Badge>}
            </div>
            {!latest?.results?.length ? <Empty text="运行全部评测后，这里会展示逐条断言" /> :
              <div className="divide-y divide-slate-100">{latest.results.map((result) =>
                <details key={result.id} className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div><span className="font-medium text-slate-800">{result.caseName}</span><span className="ml-2 text-xs text-slate-400">{result.caseKey}</span></div>
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{result.latencyMs ?? "—"} ms</span><Badge tone={result.status === "PASSED" ? "emerald" : "red"}>{result.status}</Badge></div>
                  </summary>
                  <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">{result.assertions.map((item) =>
                    <div key={item.id} className="text-xs"><span className={item.passed ? "text-emerald-700" : "text-red-700"}>{item.passed ? "✓" : "✗"} {item.label}</span><div className="mt-1 text-slate-500">期望：{item.expected} · 实际：{item.actual}</div></div>)}
                    {result.errorMessage && <div className="text-xs text-red-700">{result.errorMessage}</div>}
                    <Button size="sm" variant="ghost" disabled={running} onClick={() => run(result.caseKey)}>重跑此场景</Button>
                  </div>
                </details>)}</div>}
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><h3 className="mb-3 font-medium text-slate-900">能力域</h3><div className="space-y-3">{data.capabilities.map((item) =>
              <div key={item.capability} className="flex items-center justify-between text-sm"><span>{CAPABILITY_LABELS[item.capability] ?? item.capability}</span><span className="text-slate-500">{item.passedCaseCount}/{item.caseCount} 场景 · {item.passedAssertionCount}/{item.assertionCount} 断言</span></div>)}</div></Card>
            <Card><h3 className="mb-3 font-medium text-slate-900">失败断言</h3>{data.failures.length === 0 ? <Empty text="最近一轮没有必要断言失败" /> :
              <div className="space-y-3">{data.failures.map((item) => <div key={`${item.caseKey}-${item.label}`} className="rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-800"><div className="font-medium">{item.caseName} · {item.label}</div><div className="mt-1">期望：{item.expected}</div><div>实际：{item.actual}</div></div>)}</div>}</Card>
          </div>
          <Card><h3 className="mb-3 font-medium text-slate-900">最近运行</h3><div className="divide-y divide-slate-100">{data.runs.map((item) =>
            <div key={item.id} className="flex items-center justify-between py-2 text-sm"><span>{fmtDateTime(item.startedAt)}</span><span className="text-slate-500">{item.passedCaseCount}/{item.caseCount} · {item.averageLatencyMs ?? "—"} ms</span><Badge tone={item.status === "PASSED" ? "emerald" : "red"}>{item.status}</Badge></div>)}</div></Card>
        </div>
      )}
    </div>
  );
}
