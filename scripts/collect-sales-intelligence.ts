import { pathToFileURL } from "node:url";

export type CollectionArgs = {
  scope: "all" | "source" | "product";
  id: string | null;
  limit: number;
};

export function parseCollectionArgs(args: string[]): CollectionArgs {
  const scopes = [
    args.includes("--all") ? { scope: "all" as const, id: null } : null,
    args.includes("--source") ? { scope: "source" as const, id: args[args.indexOf("--source") + 1] } : null,
    args.includes("--product") ? { scope: "product" as const, id: args[args.indexOf("--product") + 1] } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (scopes.length !== 1) throw new Error("只能选择一个采集范围：--all、--source 或 --product");
  if (scopes[0].scope === "source" && (!scopes[0].id || scopes[0].id.startsWith("--"))) throw new Error("--source 缺少来源 id");
  if (scopes[0].scope === "product" && (!scopes[0].id || scopes[0].id.startsWith("--"))) throw new Error("--product 缺少产品 id");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("--limit 必须是 1-50 的整数");
  return { ...scopes[0], limit };
}

async function main() {
  const args = parseCollectionArgs(process.argv.slice(2));
  const baseUrl = process.env.CRM_BASE_URL ?? "http://127.0.0.1:5618/pharma";
  const day = new Date().toISOString().slice(0, 10);
  const body = {
    triggerType: args.scope === "product" ? "PRODUCT_REFRESH" : "SCHEDULED",
    sourceId: args.scope === "source" ? args.id : null,
    productId: args.scope === "product" ? args.id : null,
    confirmed: true,
    idempotencyKey: `scheduled-${args.scope}-${args.id ?? "all"}-${day}`,
  };
  const response = await fetch(`${baseUrl}/api/intelligence-collection/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(String(result?.error ?? `HTTP ${response.status}`));
  process.stdout.write(`${JSON.stringify({
    id: result.id,
    status: result.status,
    foundCount: result.foundCount,
    newCount: result.newCount,
    updatedCount: result.updatedCount,
    failedCount: result.failedCount,
    replayed: result.replayed,
  })}\n`);
  if (result.status === "FAILED") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((cause) => {
    process.stderr.write(`${cause instanceof Error ? cause.message : "采集失败"}\n`);
    process.exitCode = 1;
  });
}
