"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserProvider, useUser } from "@/lib/context";
import { isManagerRole, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/ui";
import { VisitFormDialog } from "@/components/visit-form";

const NAV_ITEMS = [
  { href: "/", label: "仪表盘", icon: "📊" },
];

/** 客户管理分组(对齐客融CRM 信息架构) */
const CUSTOMER_NAV_ITEMS = [
  { href: "/hcp", label: "个人客户", icon: "🩺" },
  { href: "/hco", label: "企业客户", icon: "🏥" },
  { href: "/kol", label: "关键客户", icon: "⭐" },
  { href: "/tiers", label: "客户分级", icon: "🏷️" },
];

const WORK_NAV_ITEMS = [
  { href: "/applications/new", label: "客户建档", icon: "📋" },
  { href: "/visits", label: "拜访记录", icon: "📝" },
  { href: "/tour-plans", label: "周计划", icon: "🗓️" },
  { href: "/samples", label: "样品库存", icon: "📦" },
  { href: "/events", label: "会议", icon: "🎤" },
  { href: "/products", label: "产品", icon: "💊" },
];

function NavLink({ href, label, icon, pathname }: { href: string; label: string; icon: string; pathname: string }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-slate-800 font-medium text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { employees, current, currentId, select } = useUser();
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const manager = isManagerRole(current?.role);

  // 200+ 员工时按办事处分组展示;组内管理岗(ASM/RSM/ADMIN)排前面
  const ROLE_ORDER: Record<string, number> = { RSM: 0, ASM: 1, ADMIN: 2, MR: 3 };
  const groups = new Map<string, typeof employees>();
  for (const e of employees) {
    const key = e.departmentName || "未分配部门";
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const sortedGroups = [...groups.entries()]
    .sort(([a], [b]) => (a === "未分配部门" ? 1 : b === "未分配部门" ? -1 : a.localeCompare(b, "zh")))
    .map(([name, list]) => [
      name,
      [...list].sort(
        (x, y) => (ROLE_ORDER[x.role] ?? 9) - (ROLE_ORDER[y.role] ?? 9) || x.name.localeCompare(y.name, "zh")
      ),
    ] as [string, typeof employees]);

  function onVisitCreated() {
    setNotice("拜访已提交");
    window.dispatchEvent(new CustomEvent("pharma-crm:visit-created"));
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
            药
          </span>
          <span className="text-lg font-semibold text-white">药启 CRM</span>
        </div>

        {/* 身份切换 */}
        <div className="px-4 pb-4">
          <label className="mb-1 block text-xs text-slate-400">当前身份</label>
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            value={currentId ?? ""}
            onChange={(e) => select(e.target.value)}
          >
            {sortedGroups.map(([deptName, list]) => (
              <optgroup key={deptName} label={deptName}>
                {list.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.employeeCode ? ` ${e.employeeCode}` : ""} · {ROLE_LABELS[e.role] ?? e.role}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 记录拜访 */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setVisitDialogOpen(true)}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + 记录拜访
          </button>
          {notice && <div className="mt-2 rounded bg-emerald-900/60 px-2 py-1 text-center text-xs text-emerald-300">{notice}</div>}
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}

          {/* 客户管理分组 */}
          <div className="px-3 pt-3 pb-1 text-xs font-medium text-slate-500">客户管理</div>
          {CUSTOMER_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}

          {/* 日常工作 */}
          <div className="px-3 pt-3 pb-1 text-xs font-medium text-slate-500">日常工作</div>
          {WORK_NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}

          {manager && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-slate-500">管理</div>
              <NavLink href="/applications/review" label="建档审核" icon="🗂️" pathname={pathname} />
              <NavLink href="/evaluations" label="拜访评定" icon="✅" pathname={pathname} />
              <NavLink href="/team" label="团队" icon="👥" pathname={pathname} />
            </>
          )}
        </nav>

        {/* 当前用户 */}
        {current && (
          <div className="border-t border-slate-800 px-5 py-4">
            <div className="text-sm font-medium text-white">
              {current.name}
              {current.employeeCode && <span className="ml-1.5 text-xs font-normal text-slate-400">{current.employeeCode}</span>}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {ROLE_LABELS[current.role] ?? current.role} · {current.division}
            </div>
            {current.territoryName && <div className="mt-0.5 text-xs text-slate-500">{current.territoryName}</div>}
          </div>
        )}
      </aside>

      <VisitFormDialog open={visitDialogOpen} onClose={() => setVisitDialogOpen(false)} onSuccess={onVisitCreated} />
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { loading, error } = useUser();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loading text="正在加载组织信息…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-md border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          初始化失败:{error}(请确认 API 服务可用)
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="ml-60 min-h-screen p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <Shell>{children}</Shell>
    </UserProvider>
  );
}
