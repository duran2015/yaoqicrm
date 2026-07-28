"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api-client";
import { useUser } from "@/lib/context";
import { formatSalesAttainment, formatSalesMom, formatSalesMoney, type MonthOverMonth } from "@/lib/sales-results";
import { Button, Card, ErrorBox, Loading, PageHeader, Select } from "@/components/ui";

type Summary = { targetAmountCents:number; actualAmountCents:number; targetQuantity:number; actualQuantity:number; attainment:number|null; monthOverMonth:MonthOverMonth; trend:Array<{month:string;actualAmountCents:number;targetAmountCents:number}> };
type Row = { id:string; name:string; targetAmountCents:number; actualAmountCents:number; attainment:number|null; monthOverMonth:MonthOverMonth };
type Detail = { name:string; months:Array<{month:string;actualAmountCents:number;attainment:number|null;activity:{visits:number;coveredHcps:number;meetings:number;completedMilestones:number}}> };

export default function SalesResultsPage() {
  const { current } = useUser();
  const [month,setMonth]=useState("2026-07");
  const [dimension,setDimension]=useState("product");
  const [summary,setSummary]=useState<Summary|null>(null);
  const [rows,setRows]=useState<Row[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{ if(!current)return; const scope=current.role==="MR"?{employeeId:current.id}:{managerId:current.id}; setLoading(true); try { const [a,b]=await Promise.all([apiGet<Summary>("/api/sales-results/summary",{month,...scope}),apiGet<Row[]>("/api/sales-results/breakdown",{month,dimension,...scope})]); setSummary(a);setRows(b);setDetail(null);setError(null); } catch(e){setError(e instanceof Error?e.message:"加载失败");} finally{setLoading(false);} },[current,month,dimension]);
  useEffect(()=>{load();},[load]);
  async function drill(id:string){ if(!current)return; const scope=current.role==="MR"?{employeeId:current.id}:{managerId:current.id}; try{setDetail(await apiGet<Detail>("/api/sales-results/detail",{month,dimension,id,...scope}));}catch(e){setError(e instanceof Error?e.message:"下钻失败");}}
  return <div>
    <PageHeader title="销售结果" desc="按月查看目标、实际、趋势与活动关联" extra={<Link href="/sales-results/import"><Button variant="outline">导入 CSV</Button></Link>} />
    <Card className="mb-5 flex gap-3 p-4"><Select value={month} onChange={e=>setMonth(e.target.value)}>{["2026-07","2026-06","2026-05","2026-04","2026-03","2026-02"].map(x=><option key={x}>{x}</option>)}</Select><Select value={dimension} onChange={e=>setDimension(e.target.value)}><option value="product">按产品</option><option value="hco">按 HCO</option><option value="employee">按代表</option></Select></Card>
    {error&&<ErrorBox message={error} onRetry={load}/>}
    {loading?<Loading text="正在汇总销售结果…"/>:summary&&<div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["目标金额",formatSalesMoney(summary.targetAmountCents)],["实际金额",formatSalesMoney(summary.actualAmountCents)],["达成率",formatSalesAttainment(summary.attainment)],["环比",formatSalesMom(summary.monthOverMonth)]].map(([a,b])=><Card className="p-4" key={a}><div className="text-sm text-slate-500">{a}</div><div className="mt-2 text-xl font-semibold">{b}</div></Card>)}</div>
      <Card className="p-5"><h2 className="mb-3 font-medium">近六个月趋势</h2><div className="h-56"><ResponsiveContainer><BarChart data={summary.trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v)=>formatSalesMoney(Number(v))}/><Bar dataKey="targetAmountCents" name="目标" fill="#cbd5e1"/><Bar dataKey="actualAmountCents" name="实际" fill="#059669"/></BarChart></ResponsiveContainer></div></Card>
      <Card className="overflow-x-auto p-5"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th>对象</th><th>目标</th><th>实际</th><th>达成率</th><th>环比</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="cursor-pointer border-t" onClick={()=>drill(row.id)}><td className="py-3 font-medium text-emerald-700">{row.name}</td><td>{formatSalesMoney(row.targetAmountCents)}</td><td>{formatSalesMoney(row.actualAmountCents)}</td><td>{formatSalesAttainment(row.attainment)}</td><td>{formatSalesMom(row.monthOverMonth)}</td></tr>)}</tbody></table></Card>
      {detail&&<Card className="p-5"><h2 className="font-medium">{detail.name} · 活动关联</h2><div className="mt-3 space-y-2">{detail.months.map(x=><div key={x.month} className="grid grid-cols-2 gap-2 rounded bg-slate-50 p-3 text-sm lg:grid-cols-6"><b>{x.month}</b><span>{formatSalesMoney(x.actualAmountCents)}</span><span>拜访 {x.activity.visits}</span><span>覆盖 {x.activity.coveredHcps}</span><span>会议 {x.activity.meetings}</span><span>完成里程碑 {x.activity.completedMilestones}</span></div>)}</div><p className="mt-3 text-xs text-slate-400">活动与同期销售变化仅作关联展示，不代表因果归因。</p></Card>}
    </div>}
  </div>;
}
