"use client";
import { useState } from "react";
import { useUser } from "@/lib/context";
import { apiUrl } from "@/lib/api-client";
import { Button, Card, ErrorBox, Notice, PageHeader } from "@/components/ui";

type Issue={line:number;message:string};
type Preview={rows:Array<Record<string,unknown>>;errors:Issue[];warnings:Issue[]};

export default function SalesImportPage(){
  const {current}=useUser(); const [preview,setPreview]=useState<Preview|null>(null); const [fileName,setFileName]=useState(""); const [error,setError]=useState<string|null>(null); const [notice,setNotice]=useState<string|null>(null);
  async function upload(file:File){const form=new FormData();form.append("file",file);setFileName(file.name);const res=await fetch(apiUrl("/api/sales-results/import-preview"),{method:"POST",body:form});const data=await res.json();if(!res.ok)setError(data.error);else{setPreview(data);setError(null);}}
  async function confirm(){if(!preview||!current)return;const res=await fetch(apiUrl("/api/sales-results/import-confirm"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName,importedById:current.id,rows:preview.rows})});const data=await res.json();if(!res.ok)setError(data.error);else setNotice(`已导入 ${data.successRows} 行销售结果`);}
  return <div><PageHeader title="导入销售结果" desc="先预览校验，再覆盖写入月度销售事实" extra={<a href={apiUrl("/api/sales-results/import-template")}><Button variant="outline">下载 CSV 示例</Button></a>}/>{notice&&<Notice kind="success" text={notice} onClose={()=>setNotice(null)}/>} {error&&<ErrorBox message={error}/>}<Card className="p-5"><input type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>{preview&&<div className="mt-5 space-y-3"><div className="text-sm">有效 {preview.rows.length} 行 · 错误 {preview.errors.length} 行 · 覆盖提示 {preview.warnings.length} 条</div>{preview.errors.map(x=><div key={`${x.line}-${x.message}`} className="rounded bg-red-50 p-2 text-sm text-red-700">第 {x.line} 行：{x.message}</div>)}{preview.warnings.map(x=><div key={`${x.line}-${x.message}`} className="rounded bg-amber-50 p-2 text-sm text-amber-700">第 {x.line} 行：{x.message}</div>)}<Button disabled={preview.errors.length>0||!preview.rows.length} onClick={confirm}>确认覆盖导入</Button></div>}</Card></div>;
}
