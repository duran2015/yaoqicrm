"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { Employee, ListResponse } from "@/lib/types";

export interface FlatEmployee {
  id: string;
  employeeCode?: string;
  name: string;
  role: string;
  division: string;
  territoryName?: string;
  departmentName?: string;
  depth: number;
}

interface UserContextValue {
  tree: Employee[];
  employees: FlatEmployee[];
  current: FlatEmployee | null;
  currentId: string | null;
  select: (id: string) => void;
  loading: boolean;
  error: string | null;
  /** 当前用户及其全部下属的 id 集合(含自身) */
  subtreeIds: Set<string>;
  /** 当前用户的组织子树根节点 */
  subtreeRoot: Employee | null;
}

const UserContext = createContext<UserContextValue | null>(null);

const STORAGE_KEY = "pharma-crm-employee-id";

function flatten(tree: Employee[], depth = 0, acc: FlatEmployee[] = []): FlatEmployee[] {
  for (const e of tree) {
    acc.push({
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      role: e.role,
      division: e.division,
      territoryName: e.territory?.name,
      departmentName: e.department?.name,
      depth,
    });
    if (e.subordinates?.length) flatten(e.subordinates, depth + 1, acc);
  }
  return acc;
}

function findNode(tree: Employee[], id: string): Employee | null {
  for (const e of tree) {
    if (e.id === id) return e;
    if (e.subordinates?.length) {
      const found = findNode(e.subordinates, id);
      if (found) return found;
    }
  }
  return null;
}

function collectIds(node: Employee | null, acc: Set<string> = new Set()): Set<string> {
  if (!node) return acc;
  acc.add(node.id);
  for (const s of node.subordinates ?? []) collectIds(s, acc);
  return acc;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<Employee[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ListResponse<Employee>>("/api/employees")
      .then((res) => {
        if (cancelled) return;
        const flat = flatten(res.data);
        setTree(res.data);
        const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        const pick =
          (saved && flat.find((e) => e.id === saved)) ||
          flat.find((e) => e.name === "陈晓明" && e.role === "MR") ||
          flat.find((e) => e.role === "MR") ||
          flat[0];
        setCurrentId(pick ? pick.id : null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载员工列表失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const employees = useMemo(() => flatten(tree), [tree]);
  const current = useMemo(() => employees.find((e) => e.id === currentId) ?? null, [employees, currentId]);
  const subtreeRoot = useMemo(() => (currentId ? findNode(tree, currentId) : null), [tree, currentId]);
  const subtreeIds = useMemo(() => collectIds(subtreeRoot), [subtreeRoot]);

  const select = useCallback((id: string) => {
    setCurrentId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  const value = useMemo(
    () => ({ tree, employees, current, currentId, select, loading, error, subtreeIds, subtreeRoot }),
    [tree, employees, current, currentId, select, loading, error, subtreeIds, subtreeRoot]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser 必须在 UserProvider 内使用");
  return ctx;
}
