"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api-client";
import { HCO_TYPE_LABELS } from "@/lib/constants";
import type { HcoDetail } from "@/lib/types";
import { Badge, Card, Empty, ErrorBox, ExamGradeBadge, InfoSection, Loading, PageHeader, Tabs, TierBadge } from "@/components/ui";
import { TierPanel, assignmentsText } from "@/components/customer";

/** 纯 CSS 圆形印章("已认证",emerald 描边) */
function VerifiedSeal() {
  return (
    <div className="flex h-20 w-20 rotate-[-12deg] items-center justify-center rounded-full border-4 border-emerald-600/70">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-600/50">
        <span className="text-sm font-bold tracking-widest text-emerald-700">已认证</span>
      </div>
    </div>
  );
}

/** 长文本折叠(诊疗科目) */
function CollapsibleText({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return <>暂无信息</>;
  if (text.length <= 60) return <>{text}</>;
  return (
    <span>
      {open ? text : `${text.slice(0, 60)}…`}
      <button className="ml-1 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => setOpen(!open)}>
        {open ? "收起" : "展开"}
      </button>
    </span>
  );
}

const TABS = [
  { key: "detail", label: "详情" },
  { key: "departments", label: "科室" },
  { key: "products", label: "进院产品" },
  { key: "exams", label: "国考成绩" },
  { key: "tier", label: "客户分级" },
];

export default function HcoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<HcoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("detail");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<HcoDetail>(`/api/hco/${id}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <Loading text="正在加载机构档案…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Empty />;

  const location = [data.province, data.city, data.district].filter(Boolean).join(" ");
  const entered = data.hospitalProducts.filter((p) => p.status === "ENTERED");
  const pool = data.hospitalProducts.filter((p) => p.status === "POOL");
  const examChartData = [...data.examResults]
    .filter((e) => e.score != null)
    .reverse()
    .map((e) => ({ year: `${e.year}`, score: e.score }));

  return (
    <div>
      <div className="mb-3 text-sm text-slate-400">
        <Link href="/hco" className="hover:text-emerald-600">
          企业客户
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600">{data.name}</span>
      </div>

      <PageHeader title={data.name} />

      {/* 头部信息 */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {data.level && <Badge tone="emerald">{data.level}</Badge>}
              <Badge tone="slate">{HCO_TYPE_LABELS[data.type] ?? data.type}</Badge>
              {data.category && <Badge tone="blue">{data.category}</Badge>}
              <TierBadge tier={data.tier} />
              {data.cooperationStatus && <Badge tone="teal">{data.cooperationStatus}</Badge>}
            </div>
            <div className="text-sm text-slate-600">
              {data.code && <span className="mr-2 font-mono text-xs text-slate-400">客户编码:{data.code}</span>}
              {location && <span className="mr-2">{location}</span>}
            </div>
            {data.businessAddress && <div className="text-xs text-slate-500">注册地址:{data.businessAddress}</div>}
            <div className="text-xs text-slate-500">合作代表:{assignmentsText(data.assignments)}</div>
          </div>
          <VerifiedSeal />
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "detail" && (
        <div className="space-y-4">
          <InfoSection
            title="基础信息"
            items={[
              { label: "客户名称", value: data.name },
              { label: "客户编码", value: data.code },
              { label: "机构类型", value: HCO_TYPE_LABELS[data.type] ?? data.type },
              { label: "统一社会信用代码", value: data.creditCode },
              { label: "医疗机构等级", value: data.level },
              { label: "省市区", value: location || null },
              { label: "其他名称", value: data.otherNames },
              { label: "注册地址", value: data.businessAddress ?? data.address },
              { label: "经营状态", value: data.businessStatus },
              { label: "联系电话", value: data.phone },
            ]}
          />
          <InfoSection
            title="工商信息"
            items={[
              { label: "注册资本", value: data.regCapital },
              { label: "成立日期", value: data.foundedDate },
              { label: "法定代表人", value: data.legalPerson },
              { label: "经营范围", value: data.businessScope },
              { label: "官网", value: data.website },
              { label: "单位介绍", value: data.introduction },
            ]}
          />
          <InfoSection
            title="机构信息"
            items={[
              { label: "医院性质", value: data.hospitalNature },
              { label: "机构类型", value: data.institutionType },
              { label: "是否医保定点", value: data.isInsurance },
              { label: "是否临床试验资格", value: data.isClinicalTrial },
              { label: "教学医院类型", value: data.teachingType },
              { label: "是否总院", value: data.isHeadquarters },
              { label: "诊疗科目", value: <CollapsibleText text={data.diagnosisSubjects} /> },
              { label: "ICU床位", value: data.icuBeds },
              { label: "开放床位", value: data.openBeds },
              { label: "核定床位", value: data.approvedBeds },
            ]}
          />
          <InfoSection
            title="管理信息"
            items={[
              { label: "医生人数", value: data.doctorCount },
              { label: "年购药金额(万元)", value: data.annualDrugPurchase },
              { label: "日门诊量", value: data.dailyOutpatient },
              { label: "年营业额(万元)", value: data.annualRevenue },
              { label: "药占比(%)", value: data.drugRatio },
              { label: "年手术量", value: data.annualSurgeries },
              { label: "年入院患者数", value: data.annualAdmissions },
              { label: "疾病领域", value: data.diseaseAreas },
            ]}
          />
          <InfoSection
            title="合作信息"
            items={[
              { label: "客户分类", value: data.category },
              { label: "战略重点医院", value: data.isStrategic },
              { label: "合作状态", value: data.cooperationStatus },
              { label: "KA负责人", value: data.kaOwner?.name },
              { label: "合作代表", value: assignmentsText(data.assignments) },
            ]}
          />
        </div>
      )}

      {tab === "departments" && (
        <Card>
          {data.departments.length === 0 ? (
            <Empty text="暂无科室信息" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">科室名称</th>
                  <th className="px-4 py-3 font-medium">标准科室</th>
                  <th className="px-4 py-3 font-medium">科室特色</th>
                  <th className="px-4 py-3 font-medium">科室排名</th>
                  <th className="px-4 py-3 font-medium">科室概况</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.departments.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.standardName ?? "暂无信息"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.feature ?? "暂无信息"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.ranking ?? "暂无信息"}</td>
                    <td className="px-4 py-3 text-slate-600">{d.overview ?? "暂无信息"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "products" && (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">
              已进院产品({entered.length})
            </div>
            {entered.length === 0 ? (
              <Empty text="暂无已进院产品" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">产品名称</th>
                    <th className="px-4 py-3 font-medium">治疗领域</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entered.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate-800">
                        {p.product.brand}({p.product.molecule})
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.product.therapeuticCategory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card>
            <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">
              客户池产品({pool.length})
            </div>
            {pool.length === 0 ? (
              <Empty text="暂无客户池产品" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">产品名称</th>
                    <th className="px-4 py-3 font-medium">治疗领域</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pool.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-slate-800">
                        {p.product.brand}({p.product.molecule})
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.product.therapeuticCategory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === "exams" && (
        <div className="space-y-4">
          <Card>
            {data.examResults.length === 0 ? (
              <Empty text="暂无国考成绩" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">年份</th>
                    <th className="px-4 py-3 font-medium">等级</th>
                    <th className="px-4 py-3 font-medium">得分</th>
                    <th className="px-4 py-3 font-medium">排名</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.examResults.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{e.year}</td>
                      <td className="px-4 py-3">
                        <ExamGradeBadge grade={e.grade} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.score ?? "暂无信息"}</td>
                      <td className="px-4 py-3 text-slate-600">{e.rank ?? "暂无信息"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {examChartData.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-medium text-slate-700">历年得分趋势</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={examChartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip formatter={(value) => [`${value} 分`, "得分"]} />
                    <Bar dataKey="score" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "tier" && <TierPanel kind="hco" customerId={data.id} currentTier={data.tier} onTierChanged={load} />}
    </div>
  );
}
