import { prisma } from "@/lib/prisma";
import { monthOverMonth, parseSalesMonth, summarizeSalesRows } from "@/lib/sales-results";

export type SalesDimension = "product" | "hco" | "employee";

function previousMonth(month: Date) {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1) - 8 * 60 * 60 * 1000);
}

function monthKey(date: Date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function employeeWhere(employeeIds?: string[]) {
  return employeeIds?.length ? { employeeId: { in: employeeIds } } : {};
}

export async function getSalesSummary({ month, employeeIds }: { month: string; employeeIds?: string[] }) {
  const range = parseSalesMonth(month);
  if (!range) throw new Error("month 必须是 YYYY-MM");
  const priorStart = previousMonth(range.start);
  const [currentRows, previousRows, trendRows] = await Promise.all([
    prisma.salesResult.findMany({ where: { month: range.start, ...employeeWhere(employeeIds) } }),
    prisma.salesResult.findMany({ where: { month: priorStart, ...employeeWhere(employeeIds) } }),
    prisma.salesResult.findMany({
      where: { month: { gte: new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 5, 1) - 8 * 60 * 60 * 1000), lte: range.start }, ...employeeWhere(employeeIds) },
      orderBy: { month: "asc" },
    }),
  ]);
  const current = summarizeSalesRows(currentRows);
  const previous = summarizeSalesRows(previousRows);
  const grouped = new Map<string, typeof trendRows>();
  for (const row of trendRows) grouped.set(monthKey(row.month), [...(grouped.get(monthKey(row.month)) ?? []), row]);
  return {
    month,
    ...current,
    monthOverMonth: monthOverMonth(current.actualAmountCents, previous.actualAmountCents),
    trend: [...grouped].map(([key, rows]) => ({ month: key, ...summarizeSalesRows(rows) })),
  };
}

export async function getSalesBreakdown({
  month,
  dimension,
  employeeIds,
}: {
  month: string;
  dimension: SalesDimension;
  employeeIds?: string[];
}) {
  const range = parseSalesMonth(month);
  if (!range) throw new Error("month 必须是 YYYY-MM");
  const rows = await prisma.salesResult.findMany({
    where: { month: { in: [range.start, previousMonth(range.start)] }, ...employeeWhere(employeeIds) },
    include: { product: true, hco: true, employee: true },
  });
  const ids = [...new Set(rows.filter((row) => row.month.getTime() === range.start.getTime()).map((row) => `${dimension === "product" ? row.productId : dimension === "hco" ? row.hcoId : row.employeeId}`))];
  return ids.map((id) => {
    const currentRows = rows.filter((row) => row.month.getTime() === range.start.getTime() && (dimension === "product" ? row.productId : dimension === "hco" ? row.hcoId : row.employeeId) === id);
    const previousRows = rows.filter((row) => row.month.getTime() !== range.start.getTime() && (dimension === "product" ? row.productId : dimension === "hco" ? row.hcoId : row.employeeId) === id);
    const current = summarizeSalesRows(currentRows);
    const first = currentRows[0];
    return {
      id,
      name: dimension === "product" ? first.product.brand : dimension === "hco" ? first.hco.name : first.employee.name,
      ...current,
      monthOverMonth: monthOverMonth(current.actualAmountCents, summarizeSalesRows(previousRows).actualAmountCents),
    };
  }).sort((a, b) => b.actualAmountCents - a.actualAmountCents);
}

export async function getSalesDetail({
  month,
  dimension,
  id,
  employeeIds,
}: {
  month: string;
  dimension: SalesDimension;
  id: string;
  employeeIds?: string[];
}) {
  const range = parseSalesMonth(month);
  if (!range) throw new Error("month 必须是 YYYY-MM");
  const start = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth() - 5, 1) - 8 * 60 * 60 * 1000);
  const dimensionWhere = dimension === "product" ? { productId: id } : dimension === "hco" ? { hcoId: id } : { employeeId: id };
  const rows = await prisma.salesResult.findMany({
    where: { month: { gte: start, lte: range.start }, ...dimensionWhere, ...employeeWhere(employeeIds) },
    include: { product: true, hco: true, employee: true },
    orderBy: { month: "asc" },
  });
  if (!rows.length) return null;
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(monthKey(row.month), [...(grouped.get(monthKey(row.month)) ?? []), row]);
  let previousActual = 0;
  const months = [];
  for (const [key, monthRows] of grouped) {
    const totals = summarizeSalesRows(monthRows);
    const monthRange = parseSalesMonth(key)!;
    const hcoIds = [...new Set(monthRows.map((row) => row.hcoId))];
    const productIds = [...new Set(monthRows.map((row) => row.productId))];
    const employeeIdsForMonth = [...new Set(monthRows.map((row) => row.employeeId))];
    const visits = await prisma.visit.findMany({
      where: {
        status: "SUBMITTED",
        visitDate: { gte: monthRange.start, lt: monthRange.end },
        hcoId: { in: hcoIds },
        employeeId: { in: employeeIdsForMonth },
        ...(dimension === "product" ? { products: { some: { productId: { in: productIds } } } } : {}),
      },
      select: { id: true, hcpId: true },
    });
    const meetings = await prisma.medEvent.count({
      where: {
        status: { in: ["OPEN", "COMPLETED"] },
        eventDate: { gte: monthRange.start, lt: monthRange.end },
        attendees: { some: { hcp: { hcoId: { in: hcoIds } } } },
      },
    });
    const completedMilestones = await prisma.accountMilestone.count({
      where: {
        status: "DONE",
        completedAt: { gte: monthRange.start, lt: monthRange.end },
        accountPlan: {
          hcoId: { in: hcoIds },
          ...(dimension === "product" ? { products: { some: { productId: { in: productIds } } } } : {}),
        },
      },
    });
    months.push({
      month: key,
      ...totals,
      monthOverMonth: monthOverMonth(totals.actualAmountCents, previousActual),
      activity: {
        visits: visits.length,
        coveredHcps: new Set(visits.flatMap((visit) => visit.hcpId ? [visit.hcpId] : [])).size,
        meetings,
        completedMilestones,
      },
    });
    previousActual = totals.actualAmountCents;
  }
  const first = rows[0];
  return {
    id,
    name: dimension === "product" ? first.product.brand : dimension === "hco" ? first.hco.name : first.employee.name,
    dimension,
    months,
  };
}
