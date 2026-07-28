import { parse } from "csv-parse/sync";

export type SalesCsvRow = {
  line: number;
  month: string;
  productCode: string;
  hcoCode: string;
  employeeCode: string;
  targetAmountCents: number;
  actualAmountCents: number;
  targetQuantity: number;
  actualQuantity: number;
};

export type MonthOverMonth =
  | { kind: "RATE"; value: number }
  | { kind: "NEW"; value: null };

export type SalesCsvIssue = { line: number; message: string };

const HEADERS = [
  "month",
  "productCode",
  "hcoCode",
  "employeeCode",
  "targetAmount",
  "actualAmount",
  "targetQuantity",
  "actualQuantity",
];

export function parseSalesMonth(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - 8 * 60 * 60 * 1000),
    end: new Date(Date.UTC(year, month, 1) - 8 * 60 * 60 * 1000),
    key: value,
  };
}

export function yuanToCents(value: unknown) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) return null;
  const [yuan, decimal = ""] = text.split(".");
  const cents = Number(yuan) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function attainment(actual: number, target: number) {
  return target > 0 ? actual / target : null;
}

export function monthOverMonth(current: number, previous: number): MonthOverMonth {
  if (previous === 0) return current === 0 ? { kind: "RATE", value: 0 } : { kind: "NEW", value: null };
  return { kind: "RATE", value: (current - previous) / previous };
}

export function summarizeSalesRows(
  rows: Array<{
    targetAmountCents: number;
    actualAmountCents: number;
    targetQuantity: number;
    actualQuantity: number;
  }>
) {
  const totals = rows.reduce(
    (sum, row) => ({
      targetAmountCents: sum.targetAmountCents + row.targetAmountCents,
      actualAmountCents: sum.actualAmountCents + row.actualAmountCents,
      targetQuantity: sum.targetQuantity + row.targetQuantity,
      actualQuantity: sum.actualQuantity + row.actualQuantity,
    }),
    { targetAmountCents: 0, actualAmountCents: 0, targetQuantity: 0, actualQuantity: 0 }
  );
  return { ...totals, attainment: attainment(totals.actualAmountCents, totals.targetAmountCents) };
}

export function formatSalesMoney(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSalesAttainment(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function formatSalesMom(value: MonthOverMonth | null) {
  if (!value) return "—";
  return value.kind === "NEW" ? "新增" : `${(value.value * 100).toFixed(1)}%`;
}

function quantity(value: unknown) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "");
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null;
}

export function parseSalesCsv(text: string): {
  validRows: SalesCsvRow[];
  errors: SalesCsvIssue[];
  warnings: SalesCsvIssue[];
} {
  let records: string[][];
  try {
    records = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true, trim: true });
  } catch {
    return { validRows: [], errors: [{ line: 1, message: "CSV 格式无法解析" }], warnings: [] };
  }
  if (!records.length || records[0].length !== HEADERS.length || records[0].some((value, index) => value !== HEADERS[index])) {
    return { validRows: [], errors: [{ line: 1, message: `表头必须为 ${HEADERS.join(",")}` }], warnings: [] };
  }
  if (records.length - 1 > 5000) {
    return { validRows: [], errors: [{ line: 0, message: "单次导入不能超过 5,000 行" }], warnings: [] };
  }

  const validRows: SalesCsvRow[] = [];
  const errors: SalesCsvIssue[] = [];
  records.slice(1).forEach((record, index) => {
    const line = index + 2;
    const month = parseSalesMonth(record[0]);
    const targetAmountCents = yuanToCents(record[4]);
    const actualAmountCents = yuanToCents(record[5]);
    const targetQuantity = quantity(record[6]);
    const actualQuantity = quantity(record[7]);
    if (
      record.length !== HEADERS.length ||
      !month ||
      !record[1] ||
      !record[2] ||
      !record[3] ||
      targetAmountCents === null ||
      actualAmountCents === null ||
      targetQuantity === null ||
      actualQuantity === null
    ) {
      errors.push({ line, message: "月份、编码、金额或数量格式不合法" });
      return;
    }
    validRows.push({
      line,
      month: month.key,
      productCode: record[1],
      hcoCode: record[2],
      employeeCode: record[3],
      targetAmountCents,
      actualAmountCents,
      targetQuantity,
      actualQuantity,
    });
  });
  return { validRows, errors, warnings: [] };
}

export function dedupeSalesRows(rows: SalesCsvRow[]) {
  const byKey = new Map<string, SalesCsvRow>();
  const warnings: SalesCsvIssue[] = [];
  for (const row of rows) {
    const key = `${row.month}\u0000${row.productCode}\u0000${row.hcoCode}\u0000${row.employeeCode}`;
    const previous = byKey.get(key);
    if (previous) warnings.push({ line: row.line, message: `覆盖同文件第 ${previous.line} 行的重复业务键` });
    byKey.set(key, row);
  }
  return { rows: [...byKey.values()], warnings };
}
