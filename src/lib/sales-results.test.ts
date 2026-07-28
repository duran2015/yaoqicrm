import assert from "node:assert/strict";
import test from "node:test";
import {
  attainment,
  dedupeSalesRows,
  formatSalesAttainment,
  formatSalesMom,
  formatSalesMoney,
  monthOverMonth,
  parseSalesCsv,
  parseSalesMonth,
  summarizeSalesRows,
  yuanToCents,
} from "./sales-results";

const header = "month,productCode,hcoCode,employeeCode,targetAmount,actualAmount,targetQuantity,actualQuantity";

test("parses sales months using Shanghai business boundaries", () => {
  assert.deepEqual(parseSalesMonth("2026-07"), {
    start: new Date("2026-06-30T16:00:00.000Z"),
    end: new Date("2026-07-31T16:00:00.000Z"),
    key: "2026-07",
  });
  assert.equal(parseSalesMonth("2026-7"), null);
  assert.equal(parseSalesMonth("2026-13"), null);
});

test("converts non-negative yuan values to exact integer cents", () => {
  assert.equal(yuanToCents("12.34"), 1234);
  assert.equal(yuanToCents("0"), 0);
  assert.equal(yuanToCents("1.234"), null);
  assert.equal(yuanToCents("-1"), null);
  assert.equal(yuanToCents("abc"), null);
});

test("calculates attainment and month-over-month edge cases", () => {
  assert.equal(attainment(80, 100), 0.8);
  assert.equal(attainment(0, 0), null);
  assert.deepEqual(monthOverMonth(120, 100), { kind: "RATE", value: 0.2 });
  assert.deepEqual(monthOverMonth(50, 0), { kind: "NEW", value: null });
  assert.deepEqual(monthOverMonth(0, 0), { kind: "RATE", value: 0 });
});

test("parses the fixed sales CSV and reports invalid rows", () => {
  const parsed = parseSalesCsv([
    header,
    "2026-07,P001,H001,YG1004,100.50,80,10,8",
    "2026-13,P001,H001,YG1004,-1,80,10,8.5",
  ].join("\n"));
  assert.equal(parsed.validRows.length, 1);
  assert.equal(parsed.validRows[0].targetAmountCents, 10050);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].line, 3);
});

test("requires the exact sales CSV header", () => {
  const parsed = parseSalesCsv("month,productCode\n2026-07,P001");
  assert.equal(parsed.validRows.length, 0);
  assert.match(parsed.errors[0].message, /表头/);
});

test("deduplicates business keys with the last CSV row winning", () => {
  const parsed = parseSalesCsv([
    header,
    "2026-07,P001,H001,YG1004,100,80,10,8",
    "2026-07,P001,H001,YG1004,100,90,10,9",
  ].join("\n"));
  const deduped = dedupeSalesRows(parsed.validRows);
  assert.equal(deduped.rows.length, 1);
  assert.equal(deduped.rows[0].actualAmountCents, 9000);
  assert.equal(deduped.warnings.length, 1);
});

test("rejects CSV input above 5000 data rows", () => {
  const row = "2026-07,P001,H001,YG1004,100,80,10,8";
  const parsed = parseSalesCsv([header, ...Array.from({ length: 5001 }, () => row)].join("\n"));
  assert.equal(parsed.validRows.length, 0);
  assert.match(parsed.errors[0].message, /5,000/);
});

test("summarizes sales facts using summed amounts instead of averaging rates", () => {
  assert.deepEqual(summarizeSalesRows([
    { targetAmountCents: 100, actualAmountCents: 50, targetQuantity: 10, actualQuantity: 5 },
    { targetAmountCents: 300, actualAmountCents: 300, targetQuantity: 30, actualQuantity: 30 },
  ]), {
    targetAmountCents: 400,
    actualAmountCents: 350,
    targetQuantity: 40,
    actualQuantity: 35,
    attainment: 0.875,
  });
});

test("formats sales presentation values without inventing zero-baseline growth", () => {
  assert.equal(formatSalesMoney(123456), "¥1,234.56");
  assert.equal(formatSalesAttainment(null), "—");
  assert.equal(formatSalesAttainment(0.875), "87.5%");
  assert.equal(formatSalesMom({ kind: "NEW", value: null }), "新增");
  assert.equal(formatSalesMom({ kind: "RATE", value: -0.1 }), "-10.0%");
});
