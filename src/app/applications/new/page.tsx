"use client";

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api-client";
import {
  ACADEMIC_TITLE_OPTIONS, ADMIN_DUTY_OPTIONS, BUSINESS_STATUS_OPTIONS, DEGREE_OPTIONS,
  DOCTOR_LEVEL_OPTIONS, EDUCATION_OPTIONS, HOSPITAL_NATURE_OPTIONS, ID_TYPE_OPTIONS,
  POOL_OPTIONS, TRI_STATE_OPTIONS,
} from "@/lib/constants";
import { useUser } from "@/lib/context";
import type { CustomerApplication, Hco, ListResponse, Product } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";
import {
  ApplicationTypeBadge, Button, Card, Empty, Field, Input, Loading, Notice,
  PageHeader, Select, Tabs, Textarea,
} from "@/components/ui";

/* ---------- 表单状态 ---------- */

const emptyHcp = {
  name: "", hcoId: "", province: "", city: "", district: "", specialty: "",
  licenseNo: "", gender: "", birthday: "", phone: "",
  doctorLevel: "", adminDuty: "", academicTitle: "",
  isPharmacyCommittee: "", isClinicalPI: "", isGroupLeader: "",
  weeklyOutpatient: "", managedBeds: "", expertise: "", practiceScope: "",
  idType: "身份证", idNumber: "",
  accountName: "", accountType: "银行卡", bankName: "", accountNo: "",
  email: "", wechat: "", hometown: "", hobbies: "", personalityTags: "",
};
type HcpForm = typeof emptyHcp;

interface EduRow {
  school: string; major: string; mentor: string; gradDate: string; degree: string; education: string;
}
const emptyEdu: EduRow = { school: "", major: "", mentor: "", gradDate: "", degree: "", education: "" };

const emptyHco = {
  type: "HOSPITAL", name: "", businessStatus: "正常", creditCode: "", level: "",
  province: "", city: "", district: "", businessAddress: "", phone: "",
  institutionType: "", hospitalNature: "", isInsurance: "", isClinicalTrial: "",
  isHeadquarters: "", teachingType: "", openBeds: "", approvedBeds: "", icuBeds: "",
  doctorCount: "", dailyOutpatient: "", annualDrugPurchase: "", drugRatio: "", annualRevenue: "",
  regCapital: "", foundedDate: "", legalPerson: "", businessScope: "", website: "",
};
type HcoForm = typeof emptyHco;

interface DeptRow {
  name: string; standardName: string; feature: string; ranking: string;
}
const emptyDept: DeptRow = { name: "", standardName: "", feature: "", ranking: "" };

const HOSPITAL_LEVELS = ["三级甲等", "三级乙等", "三级丙等", "二级甲等", "二级乙等", "二级丙等", "一级甲等", "未评级"];
const INSTITUTION_TYPES = ["综合医院", "专科医院", "中医医院", "妇幼保健院"];
const TEACHING_TYPES = ["附属医院", "教学医院", "非教学医院"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Card>
  );
}

export default function ApplicationNewPage() {
  const { current } = useUser();
  const [kind, setKind] = useState<"HCP_CREATE" | "HCO_CREATE">("HCP_CREATE");
  const [hcpForm, setHcpForm] = useState<HcpForm>(emptyHcp);
  const [hcoForm, setHcoForm] = useState<HcoForm>(emptyHco);
  const [educations, setEducations] = useState<EduRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [enteredProductIds, setEnteredProductIds] = useState<string[]>([]);
  const [pool, setPool] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  const [hcos, setHcos] = useState<Hco[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<CustomerApplication[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDrafts = useCallback(() => {
    if (!current) return;
    setDraftsLoading(true);
    apiGet<ListResponse<CustomerApplication>>("/api/applications", { status: "DRAFT", applicantId: current.id })
      .then((res) => setDrafts(res.data))
      .catch(() => setDrafts([]))
      .finally(() => setDraftsLoading(false));
  }, [current]);

  useEffect(() => {
    apiGet<ListResponse<Hco>>("/api/hco", { pageSize: 100 }).then((res) => setHcos(res.data)).catch(() => setHcos([]));
    apiGet<ListResponse<Product>>("/api/products").then((res) => setProducts(res.data)).catch(() => setProducts([]));
  }, []);

  useEffect(loadDrafts, [loadDrafts]);

  function toast(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  }

  function resetForms() {
    setHcpForm(emptyHcp);
    setHcoForm(emptyHco);
    setEducations([]);
    setDepartments([]);
    setEnteredProductIds([]);
    setEditingDraftId(null);
    setFormError(null);
  }

  /* ---------- 草稿回填 ---------- */
  async function editDraft(id: string) {
    try {
      const app = await apiGet<CustomerApplication>(`/api/applications/${id}`);
      const p = (app.parsedPayload ?? {}) as Record<string, unknown>;
      const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
      const n = (k: string) => (p[k] === null || p[k] === undefined ? "" : String(p[k]));
      if (app.type === "HCP_CREATE") {
        setKind("HCP_CREATE");
        setHcpForm({
          ...emptyHcp,
          name: s("name"), hcoId: s("hcoId"), province: s("province"), city: s("city"), district: s("district"),
          specialty: s("specialty"), licenseNo: s("licenseNo"), gender: s("gender"), birthday: s("birthday"),
          phone: s("phone"), doctorLevel: s("doctorLevel"), adminDuty: s("adminDuty"), academicTitle: s("academicTitle"),
          isPharmacyCommittee: s("isPharmacyCommittee"), isClinicalPI: s("isClinicalPI"), isGroupLeader: s("isGroupLeader"),
          weeklyOutpatient: n("weeklyOutpatient"), managedBeds: n("managedBeds"), expertise: s("expertise"),
          practiceScope: s("practiceScope"), idType: s("idType") || "身份证", idNumber: s("idNumber"),
          email: s("email"), wechat: s("wechat"), hometown: s("hometown"), hobbies: s("hobbies"),
          personalityTags: s("personalityTags"),
        });
        const edus = Array.isArray(p.educations) ? (p.educations as Partial<EduRow>[]) : [];
        setEducations(edus.map((e) => ({ ...emptyEdu, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ""])) })));
        const banks = Array.isArray(p.bankAccounts) ? (p.bankAccounts as Record<string, unknown>[]) : [];
        if (banks[0]) {
          setHcpForm((f) => ({
            ...f,
            accountName: String(banks[0].accountName ?? ""), accountType: String(banks[0].accountType ?? "银行卡"),
            bankName: String(banks[0].bankName ?? ""), accountNo: String(banks[0].accountNo ?? ""),
          }));
        }
      } else if (app.type === "HCO_CREATE") {
        setKind("HCO_CREATE");
        setHcoForm({
          ...emptyHco,
          type: s("type") || "HOSPITAL", name: s("name"), businessStatus: s("businessStatus") || "正常",
          creditCode: s("creditCode"), level: s("level"), province: s("province"), city: s("city"),
          district: s("district"), businessAddress: s("businessAddress"), phone: s("phone"),
          institutionType: s("institutionType"), hospitalNature: s("hospitalNature"), isInsurance: s("isInsurance"),
          isClinicalTrial: s("isClinicalTrial"), isHeadquarters: s("isHeadquarters"), teachingType: s("teachingType"),
          openBeds: n("openBeds"), approvedBeds: n("approvedBeds"), icuBeds: n("icuBeds"),
          doctorCount: n("doctorCount"), dailyOutpatient: n("dailyOutpatient"),
          annualDrugPurchase: n("annualDrugPurchase"), drugRatio: n("drugRatio"), annualRevenue: n("annualRevenue"),
          regCapital: s("regCapital"), foundedDate: s("foundedDate"), legalPerson: s("legalPerson"),
          businessScope: s("businessScope"), website: s("website"),
        });
        const depts = Array.isArray(p.departments) ? (p.departments as Partial<DeptRow>[]) : [];
        setDepartments(depts.map((d) => ({ ...emptyDept, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ""])) })));
        const ids = Array.isArray(p.enteredProductIds) ? (p.enteredProductIds as string[]) : [];
        setEnteredProductIds(ids);
      }
      setPool(app.pool ?? "");
      setEditingDraftId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "草稿加载失败");
    }
  }

  async function submitDraft(id: string) {
    try {
      await apiPost(`/api/applications/${id}/submit`);
      toast("草稿已提交审核");
      loadDrafts();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "提交失败");
    }
  }

  async function deleteDraft(id: string) {
    try {
      await apiDelete(`/api/applications/${id}`);
      toast("草稿已删除");
      if (editingDraftId === id) resetForms();
      loadDrafts();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "删除失败");
    }
  }

  /* ---------- 提交 ---------- */
  function buildPayload(): Record<string, unknown> | null {
    if (kind === "HCP_CREATE") {
      if (!hcpForm.name.trim()) {
        setFormError("请填写姓名");
        return null;
      }
      if (!hcpForm.hcoId) {
        setFormError("请选择工作单位");
        return null;
      }
      const payload: Record<string, unknown> = {};
      const strKeys: (keyof HcpForm)[] = [
        "province", "city", "district", "specialty", "licenseNo", "gender", "birthday", "phone",
        "doctorLevel", "adminDuty", "academicTitle", "isPharmacyCommittee", "isClinicalPI", "isGroupLeader",
        "expertise", "practiceScope", "idType", "idNumber", "email", "wechat", "hometown", "hobbies", "personalityTags",
      ];
      payload.name = hcpForm.name.trim();
      payload.hcoId = hcpForm.hcoId;
      for (const k of strKeys) if (hcpForm[k].trim()) payload[k] = hcpForm[k].trim();
      if (hcpForm.weeklyOutpatient.trim()) payload.weeklyOutpatient = Number(hcpForm.weeklyOutpatient);
      if (hcpForm.managedBeds.trim()) payload.managedBeds = Number(hcpForm.managedBeds);
      const edus = educations.filter((e) => Object.values(e).some((v) => v.trim()));
      if (edus.length) payload.educations = edus;
      if (hcpForm.bankName.trim() || hcpForm.accountNo.trim()) {
        payload.bankAccounts = [{
          accountName: hcpForm.accountName.trim() || hcpForm.name.trim(),
          accountType: hcpForm.accountType.trim() || "银行卡",
          bankName: hcpForm.bankName.trim(),
          accountNo: hcpForm.accountNo.trim(),
          isDefault: true,
        }];
      }
      return payload;
    }
    // HCO_CREATE
    if (!hcoForm.name.trim()) {
      setFormError("请填写客户名称");
      return null;
    }
    const payload: Record<string, unknown> = {};
    const strKeys: (keyof HcoForm)[] = [
      "type", "businessStatus", "creditCode", "level", "province", "city", "district", "businessAddress", "phone",
      "institutionType", "hospitalNature", "isInsurance", "isClinicalTrial", "isHeadquarters", "teachingType",
      "regCapital", "foundedDate", "legalPerson", "businessScope", "website",
    ];
    const numKeys: (keyof HcoForm)[] = [
      "openBeds", "approvedBeds", "icuBeds", "doctorCount", "dailyOutpatient", "annualDrugPurchase", "drugRatio", "annualRevenue",
    ];
    payload.name = hcoForm.name.trim();
    for (const k of strKeys) if (hcoForm[k].trim()) payload[k] = hcoForm[k].trim();
    for (const k of numKeys) if (hcoForm[k].trim()) payload[k] = Number(hcoForm[k]);
    const depts = departments.filter((d) => d.name.trim());
    if (depts.length) payload.departments = depts;
    if (enteredProductIds.length) payload.enteredProductIds = enteredProductIds;
    return payload;
  }

  async function save(submit: boolean) {
    if (!current) return;
    setFormError(null);
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    try {
      await apiPost("/api/applications", {
        type: kind,
        applicantId: current.id,
        pool: pool || undefined,
        submit,
        payload,
      });
      // 草稿编辑场景:新申请创建成功后删除旧草稿
      if (editingDraftId) {
        await apiDelete(`/api/applications/${editingDraftId}`).catch(() => undefined);
      }
      toast(submit ? "已提交,等待审核" : "草稿已暂存");
      resetForms();
      loadDrafts();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "保存失败,请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  const hcpSet = (k: keyof HcpForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setHcpForm((f) => ({ ...f, [k]: e.target.value }));
  const hcoSet = (k: keyof HcoForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setHcoForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="客户建档"
        desc={editingDraftId ? "正在编辑草稿(保存后原草稿将被替换)" : "新建个人 / 企业客户档案,可暂存草稿或立即提交审核"}
        extra={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={submitting}>
              暂存草稿
            </Button>
            <Button onClick={() => save(true)} disabled={submitting}>
              {submitting ? "提交中…" : "立即创建"}
            </Button>
          </div>
        }
      />

      {notice && <Notice kind="success" text={notice} onClose={() => setNotice(null)} />}
      {formError && <Notice kind="error" text={formError} onClose={() => setFormError(null)} />}

      <Tabs
        tabs={[
          { key: "HCP_CREATE", label: "个人客户建档" },
          { key: "HCO_CREATE", label: "企业客户建档" },
        ]}
        active={kind}
        onChange={(k) => {
          setKind(k as "HCP_CREATE" | "HCO_CREATE");
          setEditingDraftId(null);
          setFormError(null);
        }}
      />

      <div className="mb-4">
        <Card className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="客户池">
              <Select className="w-full" value={pool} onChange={(e) => setPool(e.target.value)}>
                <option value="">不选择</option>
                {POOL_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </div>

      {kind === "HCP_CREATE" && (
        <div className="space-y-4">
          <Section title="基础信息">
            <Field label="姓名" required>
              <Input value={hcpForm.name} onChange={hcpSet("name")} placeholder="医生姓名" />
            </Field>
            <Field label="工作单位" required>
              <Select className="w-full" value={hcpForm.hcoId} onChange={hcpSet("hcoId")}>
                <option value="">请选择机构</option>
                {hcos.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code ? `${h.code} · ` : ""}
                    {h.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="职业">
              <Input value="医生" disabled />
            </Field>
            <Field label="工作地(省)">
              <Input value={hcpForm.province} onChange={hcpSet("province")} placeholder="如:江苏省" />
            </Field>
            <Field label="工作地(市)">
              <Input value={hcpForm.city} onChange={hcpSet("city")} placeholder="如:苏州市" />
            </Field>
            <Field label="工作地(区/县)">
              <Input value={hcpForm.district} onChange={hcpSet("district")} />
            </Field>
            <Field label="部门科室">
              <Input value={hcpForm.specialty} onChange={hcpSet("specialty")} placeholder="如:肿瘤内科" />
            </Field>
            <Field label="医师资格证号">
              <Input value={hcpForm.licenseNo} onChange={hcpSet("licenseNo")} />
            </Field>
            <Field label="性别">
              <Select className="w-full" value={hcpForm.gender} onChange={hcpSet("gender")}>
                <option value="">请选择</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </Select>
            </Field>
            <Field label="生日">
              <Input type="date" value={hcpForm.birthday} onChange={hcpSet("birthday")} />
            </Field>
            <Field label="手机号码">
              <Input value={hcpForm.phone} onChange={hcpSet("phone")} placeholder="11 位手机号" />
            </Field>
          </Section>

          <Section title="工作信息">
            <Field label="医生等级">
              <Select className="w-full" value={hcpForm.doctorLevel} onChange={hcpSet("doctorLevel")}>
                <option value="">请选择</option>
                {DOCTOR_LEVEL_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="行政职务">
              <Select className="w-full" value={hcpForm.adminDuty} onChange={hcpSet("adminDuty")}>
                <option value="">请选择</option>
                {ADMIN_DUTY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="学术职称">
              <Select className="w-full" value={hcpForm.academicTitle} onChange={hcpSet("academicTitle")}>
                <option value="">请选择</option>
                {ACADEMIC_TITLE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="是否药事会成员">
              <Select className="w-full" value={hcpForm.isPharmacyCommittee} onChange={hcpSet("isPharmacyCommittee")}>
                <option value="">请选择</option>
                {TRI_STATE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="是否临床试验PI">
              <Select className="w-full" value={hcpForm.isClinicalPI} onChange={hcpSet("isClinicalPI")}>
                <option value="">请选择</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </Select>
            </Field>
            <Field label="是否带组医生">
              <Select className="w-full" value={hcpForm.isGroupLeader} onChange={hcpSet("isGroupLeader")}>
                <option value="">请选择</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </Select>
            </Field>
            <Field label="周门诊量">
              <Input type="number" min={0} value={hcpForm.weeklyOutpatient} onChange={hcpSet("weeklyOutpatient")} />
            </Field>
            <Field label="分管床位数">
              <Input type="number" min={0} value={hcpForm.managedBeds} onChange={hcpSet("managedBeds")} />
            </Field>
            <Field label="擅长疾病" className="sm:col-span-2 lg:col-span-1">
              <Input value={hcpForm.expertise} onChange={hcpSet("expertise")} placeholder="如:肺癌、消化道肿瘤" />
            </Field>
            <Field label="执业范围" className="sm:col-span-2">
              <Input value={hcpForm.practiceScope} onChange={hcpSet("practiceScope")} />
            </Field>
          </Section>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-medium text-slate-700">教育信息</h3>
              <Button size="sm" variant="outline" onClick={() => setEducations((l) => [...l, { ...emptyEdu }])}>
                + 添加教育经历
              </Button>
            </div>
            {educations.length === 0 && <div className="py-4 text-center text-sm text-slate-400">暂未添加,可点击右上角「添加教育经历」</div>}
            <div className="space-y-4">
              {educations.map((edu, i) => (
                <div key={i} className="rounded-md border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">教育经历 {i + 1}</span>
                    <button className="text-xs text-red-500 hover:text-red-600" onClick={() => setEducations((l) => l.filter((_, j) => j !== i))}>
                      删除
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="毕业院校">
                      <Input value={edu.school} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, school: e.target.value } : x)))} />
                    </Field>
                    <Field label="所学专业">
                      <Input value={edu.major} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, major: e.target.value } : x)))} />
                    </Field>
                    <Field label="导师姓名">
                      <Input value={edu.mentor} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, mentor: e.target.value } : x)))} />
                    </Field>
                    <Field label="毕业时间">
                      <Input type="month" value={edu.gradDate} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, gradDate: e.target.value } : x)))} />
                    </Field>
                    <Field label="学位">
                      <Select className="w-full" value={edu.degree} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, degree: e.target.value } : x)))}>
                        <option value="">请选择</option>
                        {DEGREE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="学历">
                      <Select className="w-full" value={edu.education} onChange={(e) => setEducations((l) => l.map((x, j) => (j === i ? { ...x, education: e.target.value } : x)))}>
                        <option value="">请选择</option>
                        {EDUCATION_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Section title="证件信息">
            <Field label="证件类型">
              <Select className="w-full" value={hcpForm.idType} onChange={hcpSet("idType")}>
                {ID_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="证件号码">
              <Input value={hcpForm.idNumber} onChange={hcpSet("idNumber")} placeholder="提交后仅脱敏展示" />
            </Field>
          </Section>

          <Section title="账户信息">
            <Field label="账户名称">
              <Input value={hcpForm.accountName} onChange={hcpSet("accountName")} placeholder="默认为医生姓名" />
            </Field>
            <Field label="账户类型">
              <Select className="w-full" value={hcpForm.accountType} onChange={hcpSet("accountType")}>
                <option value="银行卡">银行卡</option>
                <option value="存折">存折</option>
              </Select>
            </Field>
            <Field label="开户行">
              <Input value={hcpForm.bankName} onChange={hcpSet("bankName")} placeholder="如:招商银行苏州分行" />
            </Field>
            <Field label="银行账号">
              <Input value={hcpForm.accountNo} onChange={hcpSet("accountNo")} placeholder="提交后仅脱敏展示" />
            </Field>
          </Section>

          <Section title="其他信息">
            <Field label="邮箱">
              <Input type="email" value={hcpForm.email} onChange={hcpSet("email")} />
            </Field>
            <Field label="微信号">
              <Input value={hcpForm.wechat} onChange={hcpSet("wechat")} />
            </Field>
            <Field label="籍贯">
              <Input value={hcpForm.hometown} onChange={hcpSet("hometown")} />
            </Field>
            <Field label="爱好">
              <Input value={hcpForm.hobbies} onChange={hcpSet("hobbies")} />
            </Field>
            <Field label="性格标签">
              <Input value={hcpForm.personalityTags} onChange={hcpSet("personalityTags")} placeholder="逗号分隔" />
            </Field>
          </Section>
        </div>
      )}

      {kind === "HCO_CREATE" && (
        <div className="space-y-4">
          <Section title="基础信息">
            <Field label="机构类型">
              <Select className="w-full" value={hcoForm.type} onChange={hcoSet("type")}>
                <option value="HOSPITAL">医疗机构</option>
                <option value="PHARMACY">药店</option>
                <option value="DISTRIBUTOR">商业公司</option>
              </Select>
            </Field>
            <Field label="客户名称" required>
              <Input value={hcoForm.name} onChange={hcoSet("name")} placeholder="机构全称" />
            </Field>
            <Field label="经营状态">
              <Select className="w-full" value={hcoForm.businessStatus} onChange={hcoSet("businessStatus")}>
                {BUSINESS_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="统一社会信用代码">
              <Input value={hcoForm.creditCode} onChange={hcoSet("creditCode")} />
            </Field>
            <Field label="医疗机构等级">
              <Select className="w-full" value={hcoForm.level} onChange={hcoSet("level")}>
                <option value="">请选择</option>
                {HOSPITAL_LEVELS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="省">
              <Input value={hcoForm.province} onChange={hcoSet("province")} placeholder="如:江苏省" />
            </Field>
            <Field label="市">
              <Input value={hcoForm.city} onChange={hcoSet("city")} placeholder="如:苏州市" />
            </Field>
            <Field label="区/县">
              <Input value={hcoForm.district} onChange={hcoSet("district")} />
            </Field>
            <Field label="注册地址" className="sm:col-span-2">
              <Input value={hcoForm.businessAddress} onChange={hcoSet("businessAddress")} />
            </Field>
            <Field label="联系电话">
              <Input value={hcoForm.phone} onChange={hcoSet("phone")} />
            </Field>
          </Section>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-medium text-slate-700">科室信息</h3>
              <Button size="sm" variant="outline" onClick={() => setDepartments((l) => [...l, { ...emptyDept }])}>
                + 添加科室
              </Button>
            </div>
            {departments.length === 0 && <div className="py-4 text-center text-sm text-slate-400">暂未添加,可点击右上角「添加科室」</div>}
            <div className="space-y-4">
              {departments.map((dept, i) => (
                <div key={i} className="rounded-md border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">科室 {i + 1}</span>
                    <button className="text-xs text-red-500 hover:text-red-600" onClick={() => setDepartments((l) => l.filter((_, j) => j !== i))}>
                      删除
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="科室名称">
                      <Input value={dept.name} onChange={(e) => setDepartments((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    </Field>
                    <Field label="标准科室">
                      <Input value={dept.standardName} onChange={(e) => setDepartments((l) => l.map((x, j) => (j === i ? { ...x, standardName: e.target.value } : x)))} />
                    </Field>
                    <Field label="科室特色">
                      <Input value={dept.feature} onChange={(e) => setDepartments((l) => l.map((x, j) => (j === i ? { ...x, feature: e.target.value } : x)))} />
                    </Field>
                    <Field label="科室排名">
                      <Input value={dept.ranking} onChange={(e) => setDepartments((l) => l.map((x, j) => (j === i ? { ...x, ranking: e.target.value } : x)))} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Section title="机构信息">
            <Field label="医疗机构类型">
              <Select className="w-full" value={hcoForm.institutionType} onChange={hcoSet("institutionType")}>
                <option value="">请选择</option>
                {INSTITUTION_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="医院性质">
              <Select className="w-full" value={hcoForm.hospitalNature} onChange={hcoSet("hospitalNature")}>
                <option value="">请选择</option>
                {HOSPITAL_NATURE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="是否医保定点">
              <Select className="w-full" value={hcoForm.isInsurance} onChange={hcoSet("isInsurance")}>
                <option value="">请选择</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </Select>
            </Field>
            <Field label="是否临床试验机构">
              <Select className="w-full" value={hcoForm.isClinicalTrial} onChange={hcoSet("isClinicalTrial")}>
                <option value="">请选择</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </Select>
            </Field>
            <Field label="是否总院">
              <Select className="w-full" value={hcoForm.isHeadquarters} onChange={hcoSet("isHeadquarters")}>
                <option value="">请选择</option>
                <option value="是">是</option>
                <option value="否">否</option>
              </Select>
            </Field>
            <Field label="教学医院类型">
              <Select className="w-full" value={hcoForm.teachingType} onChange={hcoSet("teachingType")}>
                <option value="">请选择</option>
                {TEACHING_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="开放床位">
              <Input type="number" min={0} value={hcoForm.openBeds} onChange={hcoSet("openBeds")} />
            </Field>
            <Field label="核定床位">
              <Input type="number" min={0} value={hcoForm.approvedBeds} onChange={hcoSet("approvedBeds")} />
            </Field>
            <Field label="ICU床位">
              <Input type="number" min={0} value={hcoForm.icuBeds} onChange={hcoSet("icuBeds")} />
            </Field>
          </Section>

          <Card className="p-5">
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">管理信息</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="医生人数">
                <Input type="number" min={0} value={hcoForm.doctorCount} onChange={hcoSet("doctorCount")} />
              </Field>
              <Field label="日门诊量">
                <Input type="number" min={0} value={hcoForm.dailyOutpatient} onChange={hcoSet("dailyOutpatient")} />
              </Field>
              <Field label="年购药金额(万元)">
                <Input type="number" min={0} value={hcoForm.annualDrugPurchase} onChange={hcoSet("annualDrugPurchase")} />
              </Field>
              <Field label="药占比(%)">
                <Input type="number" min={0} step="0.1" value={hcoForm.drugRatio} onChange={hcoSet("drugRatio")} />
              </Field>
              <Field label="年营业额(万元)">
                <Input type="number" min={0} value={hcoForm.annualRevenue} onChange={hcoSet("annualRevenue")} />
              </Field>
            </div>
            <div className="mt-4">
              <span className="mb-2 block text-xs font-medium text-slate-600">已进院产品(可多选)</span>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const checked = enteredProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setEnteredProductIds((l) => (checked ? l.filter((x) => x !== p.id) : [...l, p.id]))
                      }
                      className={
                        checked
                          ? "rounded-md border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700"
                          : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      }
                    >
                      {p.brand}({p.molecule})
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Section title="工商信息">
            <Field label="注册资本">
              <Input value={hcoForm.regCapital} onChange={hcoSet("regCapital")} placeholder="如:5000万元" />
            </Field>
            <Field label="成立日期">
              <Input type="date" value={hcoForm.foundedDate} onChange={hcoSet("foundedDate")} />
            </Field>
            <Field label="法定代表人">
              <Input value={hcoForm.legalPerson} onChange={hcoSet("legalPerson")} />
            </Field>
            <Field label="官网">
              <Input value={hcoForm.website} onChange={hcoSet("website")} placeholder="https://" />
            </Field>
            <Field label="经营范围" className="sm:col-span-2">
              <Textarea rows={2} value={hcoForm.businessScope} onChange={hcoSet("businessScope")} />
            </Field>
          </Section>
        </div>
      )}

      {/* 我的草稿 */}
      <div className="mt-6">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-medium text-slate-700">我的草稿</div>
          {draftsLoading ? (
            <Loading text="正在加载草稿…" />
          ) : drafts.length === 0 ? (
            <Empty text="暂无草稿" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">客户名称</th>
                  <th className="px-4 py-3 font-medium">客户池</th>
                  <th className="px-4 py-3 font-medium">暂存时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((d) => {
                  let name = "—";
                  try {
                    const p = JSON.parse(d.payload) as { name?: string };
                    name = p.name ?? "—";
                  } catch {
                    /* 忽略 */
                  }
                  return (
                    <tr key={d.id}>
                      <td className="px-4 py-3">
                        <ApplicationTypeBadge type={d.type} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                      <td className="px-4 py-3 text-slate-600">{d.pool ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDateTime(d.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => editDraft(d.id)}>
                            继续编辑
                          </Button>
                          <Button size="sm" onClick={() => submitDraft(d.id)}>
                            提交
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteDraft(d.id)}>
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
