"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { HCO_TYPE_LABELS, ROLE_LABELS, SENTIMENT_LABELS, VISIT_TYPE_LABELS } from "@/lib/constants";
import type { HcpDetail } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { Badge, Button, Card, Empty, ErrorBox, InfoSection, Loading, PageHeader, SourceBadge, Tabs, TierBadge, ValidityBadge } from "@/components/ui";
import { TierPanel, assignmentsText } from "@/components/customer";
import { VisitFormDialog } from "@/components/visit-form";

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

const TABS = [
  { key: "detail", label: "详情" },
  { key: "tier", label: "客户分级" },
];

export default function HcpDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<HcpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState("detail");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<HcpDetail>(`/api/hcp/${id}`)
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

  if (loading) return <Loading text="正在加载医生档案…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Empty />;

  const tags = data.tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
  const totalSamples = data.sampleSummary.reduce((sum, s) => sum + s.totalQty, 0);

  return (
    <div>
      <div className="mb-3 text-sm text-slate-400">
        <Link href="/hcp" className="hover:text-emerald-600">
          个人客户
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-600">{data.name}</span>
      </div>

      <PageHeader
        title={data.name}
        extra={
          <Button onClick={() => setDialogOpen(true)}>+ 记录拜访</Button>
        }
      />

      {notice && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {data.followUpTasks.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-amber-900">待跟进事项</h2>
            <Link href="/tasks" className="text-xs text-amber-700 hover:underline">进入任务中心</Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {data.followUpTasks.map((task) => (
              <div key={task.id} className="rounded-md bg-white/70 px-3 py-2 text-sm text-slate-700">
                {task.title}
                <span className="ml-2 text-xs text-slate-400">
                  {task.dueDate ? `截止 ${fmtDate(task.dueDate)}` : "未设截止日期"} · {task.assignee.name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 头部信息 */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={data.tier} />
              {data.title && <Badge tone="blue">{data.title}</Badge>}
              {data.specialty && <Badge tone="slate">{data.specialty}</Badge>}
              {tags.map((t) => (
                <Badge key={t} tone="amber">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="text-sm text-slate-600">
              {data.code && <span className="mr-2 font-mono text-xs text-slate-400">{data.code}</span>}
              {data.hco?.name ?? "未关联机构"}
              {data.hco?.code && <span className="ml-2 font-mono text-xs text-slate-400">{data.hco.code}</span>}
              {data.hco?.level && <span className="ml-2 text-xs text-slate-400">{data.hco.level}</span>}
              {data.hco?.type && (
                <span className="ml-2 text-xs text-slate-400">{HCO_TYPE_LABELS[data.hco.type] ?? data.hco.type}</span>
              )}
            </div>
            {data.hco?.territory?.name && <div className="text-xs text-slate-400">辖区:{data.hco.territory.name}</div>}
            <div className="text-xs text-slate-500">合作代表:{assignmentsText(data.assignments)}</div>
            {data.notes && <div className="text-xs text-slate-500">备注:{data.notes}</div>}
          </div>
          <div className="space-y-1 text-right text-sm text-slate-600">
            <div>电话:{data.phone ?? "—"}</div>
            <div>微信:{data.wechat ?? "—"}</div>
          </div>
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "tier" && <TierPanel kind="hcp" customerId={data.id} currentTier={data.tier} onTierChanged={load} />}

      {tab === "detail" && (
        <>
          {/* 档案分区卡片 */}
          <div className="mb-5 space-y-4">
            <InfoSection
              title="基础信息"
              items={[
                { label: "客户编码", value: data.code },
                { label: "性别", value: data.gender },
                { label: "生日", value: data.birthday },
                { label: "手机号", value: data.phone },
                { label: "工作单位", value: data.hco?.name },
                { label: "科室", value: data.specialty },
                { label: "职业", value: "医生" },
                { label: "医师资格证号", value: data.licenseNo },
              ]}
            />
            <InfoSection
              title="工作信息"
              items={[
                { label: "医生等级", value: data.doctorLevel },
                { label: "行政职务", value: data.adminDuty },
                { label: "学术职称", value: data.academicTitle },
                { label: "是否药事会成员", value: data.isPharmacyCommittee },
                { label: "是否临床试验PI", value: data.isClinicalPI },
                { label: "是否带组医生", value: data.isGroupLeader },
                { label: "周门诊量", value: data.weeklyOutpatient },
                { label: "分管床位", value: data.managedBeds },
                { label: "擅长疾病", value: data.expertise },
                { label: "执业范围", value: data.practiceScope },
              ]}
            />
            <Card className="p-5">
              <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">教育信息</h3>
              {data.educations.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">暂无信息</div>
              ) : (
                <div className="space-y-2">
                  {data.educations.map((e, i) => (
                    <div key={e.id ?? i} className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-medium">{e.school ?? "—"}</span>
                      {e.major && <span>{e.major}</span>}
                      {e.degree && <span>{e.degree}</span>}
                      {e.education && <span>{e.education}</span>}
                      {e.gradDate && <span className="text-slate-500">{e.gradDate}</span>}
                      {e.mentor && <span className="text-slate-500">导师:{e.mentor}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <InfoSection
              title="证件信息"
              items={[
                { label: "证件类型", value: data.idType },
                { label: "证件号码", value: data.idNumber },
              ]}
            />
            <Card className="p-5">
              <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">账户信息</h3>
              {data.bankAccounts.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">暂无信息</div>
              ) : (
                <div className="space-y-2">
                  {data.bankAccounts.map((b, i) => (
                    <div key={b.id ?? i} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-medium">{b.bankName ?? "—"}</span>
                      <span className="font-mono text-xs text-slate-600">{b.accountNo ?? "—"}</span>
                      {b.accountType && <span>{b.accountType}</span>}
                      {b.accountName && <span className="text-slate-500">户名:{b.accountName}</span>}
                      {b.isDefault && <Badge tone="emerald">默认账户</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <InfoSection
              title="其他信息"
              items={[
                { label: "邮箱", value: data.email },
                { label: "籍贯", value: data.hometown },
                { label: "爱好", value: data.hobbies },
                { label: "性格标签", value: data.personalityTags },
              ]}
            />
          </div>

          {/* 统计条 */}
          <Card className="mb-5 grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
            <StatItem label="总拜访次数" value={`${data.stats.visitCount} 次`} />
            <StatItem label="最近拜访" value={fmtDate(data.stats.lastVisitDate)} />
            <StatItem label="收到样品" value={`${totalSamples} 盒`} />
            <StatItem label="参会次数" value={`${data.stats.eventCount} 次`} />
          </Card>

          {data.sampleSummary.length > 0 && (
            <Card className="mb-5 p-5">
              <h3 className="mb-2 text-sm font-medium text-slate-700">样品接收汇总</h3>
              <div className="flex flex-wrap gap-2">
                {data.sampleSummary.map((s) => (
                  <Badge key={s.product.id} tone="teal" className="px-2.5 py-1">
                    {s.product.brand}({s.product.molecule})× {s.totalQty} 盒
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* 拜访历史时间线 */}
            <div className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-medium text-slate-700">拜访历史({data.visits.length})</h3>
              {data.visits.length === 0 ? (
                <Card>
                  <Empty text="暂无拜访记录" />
                </Card>
              ) : (
                <div className="space-y-3">
                  {data.visits.map((v) => (
                    <Card key={v.id} className="p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{fmtDateTime(v.visitDate)}</span>
                          <Badge tone="teal">{VISIT_TYPE_LABELS[v.type] ?? v.type}</Badge>
                          <ValidityBadge status={v.validityStatus} />
                          <SourceBadge source={v.source} />
                          {v.duration != null && <span className="text-xs text-slate-400">{v.duration} 分钟</span>}
                        </div>
                        <span className="text-xs text-slate-400">
                          {v.employee.name} · {ROLE_LABELS[v.employee.role] ?? v.employee.role}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-sm text-slate-600">
                        {(v.purpose || v.outcome) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {v.purpose && (
                              <span>
                                目的:<span className="text-slate-700">{v.purpose}</span>
                              </span>
                            )}
                            {v.outcome && (
                              <span>
                                结果:<span className="font-medium text-emerald-700">{v.outcome}</span>
                              </span>
                            )}
                          </div>
                        )}
                        {v.notes && <p className="rounded bg-slate-50 px-3 py-2 text-xs leading-relaxed">{v.notes}</p>}
                        {v.summary && (
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                            <div className="mb-1 text-xs font-medium text-slate-600">📝 人工总结</div>
                            <p className="text-xs leading-relaxed text-slate-700">{v.summary}</p>
                          </div>
                        )}

                        {v.products.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {v.products.map((p) => (
                              <Badge key={p.id} tone="blue">
                                {p.product.brand}
                                {p.feedback ? `:${p.feedback}` : ""}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {v.samples.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {v.samples.map((s) => (
                              <Badge key={s.id} tone="amber">
                                样品 {s.lot.product.brand} × {s.quantity}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {v.aiSummary && (
                          <div className="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-700">
                              ✨ AI 摘要
                              {v.aiSentiment && <Badge tone="emerald">{SENTIMENT_LABELS[v.aiSentiment] ?? v.aiSentiment}</Badge>}
                            </div>
                            <p className="text-xs leading-relaxed text-emerald-900">{v.aiSummary}</p>
                          </div>
                        )}

                        {v.nextStep && (
                          <div className="text-xs text-slate-500">
                            <span className="font-medium text-slate-600">下一步:</span>
                            {v.nextStep}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* 参会记录 */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-700">参会记录({data.eventAttendances.length})</h3>
              {data.eventAttendances.length === 0 ? (
                <Card>
                  <Empty text="暂无参会记录" />
                </Card>
              ) : (
                <div className="space-y-3">
                  {data.eventAttendances.map((a) => (
                    <Card key={a.id} className="p-4">
                      <div className="text-sm font-medium text-slate-800">{a.event.name}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone="slate">{a.event.type}</Badge>
                        <span>{fmtDate(a.event.eventDate)}</span>
                      </div>
                      {a.event.location && <div className="mt-1 text-xs text-slate-400">{a.event.location}</div>}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <VisitFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        preselectedHcp={{ id: data.id, name: data.name }}
        onSuccess={() => {
          setNotice("拜访已提交");
          setTimeout(() => setNotice(null), 3000);
          load();
        }}
      />
    </div>
  );
}
