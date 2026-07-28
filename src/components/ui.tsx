"use client";

import { cn } from "@/lib/utils";

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

/* ---------- Badge ---------- */
type BadgeTone = "slate" | "emerald" | "amber" | "red" | "blue" | "teal";
const badgeTones: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
  teal: "bg-teal-50 text-teal-700",
};
export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/** 客户分级 badge:A=红 / B=橙 / C=蓝 / D=灰 / 未分级=浅灰 */
export function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <Badge tone="slate" className="bg-slate-100 text-slate-500">未分级</Badge>;
  const tone = tier === "A" ? "red" : tier === "B" ? "amber" : tier === "C" ? "blue" : "slate";
  return <Badge tone={tone}>{tier} 级</Badge>;
}

/** 国考成绩等级 badge:A++红 / A+橙 / A蓝 / B++及以下灰 */
export function ExamGradeBadge({ grade }: { grade?: string | null }) {
  if (!grade) return <Badge tone="slate">—</Badge>;
  const tone = grade === "A++" ? "red" : grade === "A+" ? "amber" : grade === "A" ? "blue" : "slate";
  return <Badge tone={tone}>{grade}</Badge>;
}

/** 申请类型 badge:个人建档/企业建档/档案修改 */
export function ApplicationTypeBadge({ type }: { type: string }) {
  const label = type === "HCP_CREATE" ? "个人建档" : type === "HCO_CREATE" ? "企业建档" : "档案修改";
  const tone = type === "HCP_CREATE" ? "blue" : type === "HCO_CREATE" ? "teal" : "amber";
  return <Badge tone={tone}>{label}</Badge>;
}

/** 申请状态 badge:DRAFT灰 / PENDING橙 / APPROVED绿 / REJECTED红 */
export function ApplicationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    DRAFT: { label: "草稿", tone: "slate" },
    PENDING: { label: "待审核", tone: "amber" },
    APPROVED: { label: "已批准", tone: "emerald" },
    REJECTED: { label: "已驳回", tone: "red" },
  };
  const m = map[status] ?? { label: status, tone: "slate" as BadgeTone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Tabs(对齐参考系统多 tab 详情页) */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-t-md px-4 py-2 text-sm transition-colors",
            active === t.key
              ? "border-b-2 border-emerald-600 font-medium text-emerald-700"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** 分区信息卡片(详情页"基础信息/工作信息"等键值对分区) */
export function InfoSection({
  title,
  items,
  columns = 3,
}: {
  title: string;
  items: { label: string; value: React.ReactNode }[];
  columns?: 2 | 3 | 4;
}) {
  const grid = columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";
  return (
    <Card className="p-5">
      <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-medium text-slate-700">{title}</h3>
      <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3", grid)}>
        {items.map((item) => (
          <div key={item.label} className="text-sm">
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className="mt-0.5 text-slate-700">
              {item.value === null || item.value === undefined || item.value === "" ? "暂无信息" : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** 拜访有效性 badge:有效=绿 / 无效=红 / 未评定=灰 */
export function ValidityBadge({ status, reason }: { status?: string | null; reason?: string | null }) {
  const s = status ?? "PENDING";
  const tone = s === "VALID" ? "emerald" : s === "INVALID" ? "red" : "slate";
  const label = s === "VALID" ? "有效" : s === "INVALID" ? "无效" : "未评定";
  return (
    <Badge tone={tone} className={reason ? "cursor-help" : undefined}>
      {label}
      {s === "INVALID" && reason ? `:${reason}` : ""}
    </Badge>
  );
}

/** 拜访来源 badge:MANUAL=手工 / AI=AI 录入 / IMPORT=导入 */
export function SourceBadge({ source }: { source?: string | null }) {
  const s = source ?? "MANUAL";
  if (s === "AI") return <Badge tone="blue">AI 录入</Badge>;
  if (s === "IMPORT") return <Badge tone="amber">导入</Badge>;
  return <Badge tone="slate">手工</Badge>;
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function PageHeader({ title, desc, extra }: { title: string; desc?: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {extra}
    </div>
  );
}

/* ---------- 表单控件 ---------- */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={onClose}>
      <div
        className={cn("w-full rounded-lg bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="关闭">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- 状态组件 ---------- */
export function Loading({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      {text}
    </div>
  );
}

export function Empty({ text = "暂无数据" }: { text?: string }) {
  return <div className="py-12 text-center text-sm text-slate-400">{text}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} />;
}

/** 成功/失败提示条 */
export function Notice({ kind, text, onClose }: { kind: "success" | "error"; text: string; onClose?: () => void }) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between rounded-md border px-4 py-2.5 text-sm",
        kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <span>{text}</span>
      {onClose && (
        <button onClick={onClose} className="ml-3 text-current opacity-60 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}
