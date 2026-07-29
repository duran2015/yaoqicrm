"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client"; import { useUser } from "@/lib/context";
import { Badge, Button, Card, Empty, ErrorBox, PageHeader } from "@/components/ui"; import { fmtDateTime } from "@/lib/utils";
type TokenRow={id:string;name:string;tokenHint:string;status:string;createdAt:string;lastUsedAt?:string};
type Issued={token:string;config:unknown;record:TokenRow};
export default function McpTokensPage(){
 const {current}=useUser(); const [rows,setRows]=useState<TokenRow[]>([]); const [issued,setIssued]=useState<Issued|null>(null); const [error,setError]=useState<string|null>(null);
 const employeeId=current?.id;
 const load=useCallback(()=>{if(current)apiGet<TokenRow[]>("/api/mcp-service-tokens",{employeeId:current.id}).then(setRows).catch(e=>setError(e.message));},[current]);
 useEffect(load,[load]); if(!current)return null;
 async function create(){if(!employeeId)return;try{const value=await apiPost<Issued>("/api/mcp-service-tokens",{employeeId,name:"Zerone 全功能演示"});setIssued(value);load();}catch(e){setError((e as Error).message)}}
 async function action(id:string,kind:"revoke"|"rotate"){if(!employeeId)return;try{const value=await apiPost<Issued|TokenRow>(`/api/mcp-service-tokens/${id}/${kind}`,{employeeId});if(kind==="rotate")setIssued(value as Issued);load();}catch(e){setError((e as Error).message)}}
 return <div><PageHeader title="MCP Token 管理" desc="为 Zerone/WorkBuddy 客户端分发独立、可撤销的长期访问凭证" extra={<Button onClick={create}>生成长期 Token</Button>}/>
 {error&&<ErrorBox message={error} onRetry={load}/>}
 {issued&&<Card className="mb-5 border-amber-200 bg-amber-50"><h3 className="font-medium">请立即复制，仅显示一次</h3><pre className="my-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-emerald-300">{JSON.stringify(issued.config,null,2)}</pre><Button onClick={()=>navigator.clipboard.writeText(JSON.stringify(issued.config,null,2))}>复制 JSON 配置</Button></Card>}
 <Card>{rows.length===0?<Empty text="尚未生成 MCP Token"/>:<div className="divide-y">{rows.map(r=><div key={r.id} className="flex items-center justify-between py-3 text-sm"><div><div className="font-medium">{r.name} · ••••{r.tokenHint}</div><div className="text-xs text-slate-500">创建 {fmtDateTime(r.createdAt)} · 最近使用 {r.lastUsedAt?fmtDateTime(r.lastUsedAt):"从未"}</div></div><div className="flex gap-2"><Badge tone={r.status==="ACTIVE"?"emerald":"slate"}>{r.status}</Badge>{r.status==="ACTIVE"&&<><Button size="sm" variant="ghost" onClick={()=>action(r.id,"rotate")}>轮换</Button><Button size="sm" variant="danger" onClick={()=>action(r.id,"revoke")}>撤销</Button></>}</div></div>)}</div>}</Card></div>
}
