import { prisma } from "@/lib/prisma";
import { dedupeSalesRows, parseSalesCsv, parseSalesMonth, type SalesCsvRow } from "@/lib/sales-results";

export type NormalizedSalesRow = Omit<SalesCsvRow, "productCode" | "hcoCode" | "employeeCode"> & {
  productId: string;
  hcoId: string;
  employeeId: string;
  productCode: string;
  hcoCode: string;
  employeeCode: string;
};

export async function previewSalesImport(text: string) {
  const parsed = parseSalesCsv(text);
  const deduped = dedupeSalesRows(parsed.validRows);
  const [products, hcos, employees] = await Promise.all([
    prisma.product.findMany(),
    prisma.hco.findMany({ where: { code: { in: deduped.rows.map((row) => row.hcoCode) } } }),
    prisma.employee.findMany({ where: { employeeCode: { in: deduped.rows.map((row) => row.employeeCode) } } }),
  ]);
  const productByCode = new Map(products.map((item, index) => [`P${String(index + 1).padStart(3, "0")}`, item]));
  const hcoByCode = new Map(hcos.map((item) => [item.code!, item]));
  const employeeByCode = new Map(employees.map((item) => [item.employeeCode, item]));
  const rows: NormalizedSalesRow[] = [];
  const errors = [...parsed.errors];
  for (const row of deduped.rows) {
    const product = productByCode.get(row.productCode);
    const hco = hcoByCode.get(row.hcoCode);
    const employee = employeeByCode.get(row.employeeCode);
    if (!product || !hco || !employee) {
      errors.push({ line: row.line, message: "产品、HCO 或员工编码不存在" });
    } else if (product.division !== employee.division) {
      errors.push({ line: row.line, message: "产品与员工事业部不一致" });
    } else {
      rows.push({ ...row, productId: product.id, hcoId: hco.id, employeeId: employee.id });
    }
  }
  return { rows, errors, warnings: [...parsed.warnings, ...deduped.warnings] };
}

export async function confirmSalesImport(fileName: string, importedById: string, rows: NormalizedSalesRow[]) {
  if (!fileName.trim() || !rows.length) throw new Error("文件名和有效数据不能为空");
  const preview = await previewSalesImport([
    "month,productCode,hcoCode,employeeCode,targetAmount,actualAmount,targetQuantity,actualQuantity",
    ...rows.map((row) => `${row.month},${row.productCode},${row.hcoCode},${row.employeeCode},${(row.targetAmountCents / 100).toFixed(2)},${(row.actualAmountCents / 100).toFixed(2)},${row.targetQuantity},${row.actualQuantity}`),
  ].join("\n"));
  if (preview.errors.length || preview.rows.length !== rows.length) throw new Error("预览数据已失效，请重新上传");
  return prisma.$transaction(async (tx) => {
    const batch = await tx.salesImportBatch.create({
      data: { fileName: fileName.trim(), importedById, status: "COMPLETED", totalRows: rows.length, successRows: rows.length, failedRows: 0 },
    });
    for (const row of preview.rows) {
      await tx.salesResult.upsert({
        where: { month_productId_hcoId_employeeId: { month: parseSalesMonth(row.month)!.start, productId: row.productId, hcoId: row.hcoId, employeeId: row.employeeId } },
        update: { targetAmountCents: row.targetAmountCents, actualAmountCents: row.actualAmountCents, targetQuantity: row.targetQuantity, actualQuantity: row.actualQuantity, importBatchId: batch.id },
        create: { month: parseSalesMonth(row.month)!.start, productId: row.productId, hcoId: row.hcoId, employeeId: row.employeeId, targetAmountCents: row.targetAmountCents, actualAmountCents: row.actualAmountCents, targetQuantity: row.targetQuantity, actualQuantity: row.actualQuantity, importBatchId: batch.id },
      });
    }
    return batch;
  });
}
