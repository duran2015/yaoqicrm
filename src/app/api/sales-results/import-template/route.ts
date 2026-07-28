export async function GET() {
  const csv = "month,productCode,hcoCode,employeeCode,targetAmount,actualAmount,targetQuantity,actualQuantity\n2026-07,P001,HOS001,YG1004,100000.00,92000.00,1000,920\n";
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sales-results-template.csv"' } });
}
