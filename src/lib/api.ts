import { NextResponse } from "next/server";
import { prisma } from "./prisma";

/** 统一错误返回:{ error: string } + 状态码 */
export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 解析 ISO 日期字符串,非法或为空时返回 null */
export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 取某天 00:00(本地时区) */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 取本周周一 00:00 */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 周一 = 0
  x.setDate(x.getDate() - dow);
  return x;
}

/** 取本月 1 号 00:00 */
export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

/** 收集某员工的整棵下属子树 id(含自身) */
export async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const all = await prisma.employee.findMany({ select: { id: true, reportsToId: true } });
  const children = new Map<string, string[]>();
  for (const e of all) {
    if (!e.reportsToId) continue;
    const list = children.get(e.reportsToId) ?? [];
    list.push(e.id);
    children.set(e.reportsToId, list);
  }
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const c of children.get(cur) ?? []) {
      ids.push(c);
      queue.push(c);
    }
  }
  return ids;
}

/** 判断角色是否管理岗(聚合子树用) */
export function isManager(role: string): boolean {
  return role === "ASM" || role === "RSM" || role === "ADMIN";
}
