import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { collectEnabledSources, initialVerification } from "@/lib/intelligence-collector";
import { htmlListCollector } from "@/lib/intelligence-collectors/html-list";
import { rssCollector } from "@/lib/intelligence-collectors/rss";
import { searchCollector } from "@/lib/intelligence-collectors/search";
import {
  canonicalizeSourceUrl,
  classifyCollectedDocument,
  decideCollectedDocument,
  fingerprintIntelligence,
} from "@/lib/intelligence-normalization";
import { INTELLIGENCE_TYPES } from "@/lib/sales-intelligence";

const collectors = { RSS: rssCollector, LIST_PAGE: htmlListCollector, SEARCH: searchCollector };

function collectionInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const triggerTypes = ["SCHEDULED", "MANUAL", "PRODUCT_REFRESH", "AGENT_SEARCH"];
  if (item.confirmed !== true || !triggerTypes.includes(String(item.triggerType))) return null;
  const idempotencyKey = typeof item.idempotencyKey === "string" ? item.idempotencyKey.trim() : "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) return null;
  return {
    triggerType: String(item.triggerType),
    sourceId: typeof item.sourceId === "string" && item.sourceId.trim() ? item.sourceId.trim() : null,
    productId: typeof item.productId === "string" && item.productId.trim() ? item.productId.trim() : null,
    requestedById: typeof item.requestedById === "string" && item.requestedById.trim() ? item.requestedById.trim() : null,
    idempotencyKey,
  };
}

export async function GET() {
  return NextResponse.json(await prisma.collectionRun.findMany({
    include: { source: true, product: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  }));
}

export async function POST(req: NextRequest) {
  const input = collectionInput(await req.json().catch(() => null));
  if (!input) return err("采集参数、确认状态或幂等键不合法");
  const replay = await prisma.collectionRun.findFirst({
    where: {
      requestedById: input.requestedById,
      triggerType: input.triggerType,
      idempotencyKey: input.idempotencyKey,
    },
  });
  if (replay) return NextResponse.json({ ...replay, replayed: true });

  const sources = await prisma.intelligenceSource.findMany({
    where: {
      enabled: true,
      ...(input.sourceId ? { id: input.sourceId } : {}),
    },
  });
  if (!sources.length) return err("没有可用的采集来源", 404);
  const run = await prisma.collectionRun.create({
    data: {
      triggerType: input.triggerType,
      sourceId: input.sourceId,
      productId: input.productId,
      requestedById: input.requestedById,
      idempotencyKey: input.idempotencyKey,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const vocabulary = await Promise.all([
    prisma.product.findMany({ select: { id: true, brand: true, molecule: true, therapeuticCategory: true } }),
    prisma.competitorProduct.findMany({ where: { active: true }, select: { id: true, name: true, molecule: true } }),
  ]);
  const result = await collectEnabledSources({
    sources,
    limitPerSource: 20,
    timeoutMs: 12_000,
  }, collectors);
  let newCount = 0;
  let updatedCount = 0;
  let failedCount = result.failures.length;

  for (const document of result.documents) {
    const canonicalUrl = canonicalizeSourceUrl(document.sourceUrl);
    if (!canonicalUrl || !document.title.trim()) {
      failedCount += 1;
      continue;
    }
    const source = sources.find((item) => canonicalUrl.startsWith(new URL(item.baseUrl).origin))
      ?? sources.find((item) => item.sourceType === "SEARCH")
      ?? sources[0];
    const contentHash = fingerprintIntelligence(`${document.title} ${document.excerpt}`);
    const existing = await prisma.salesIntelligence.findMany({
      where: { OR: [{ canonicalUrl }, { contentHash }] },
      select: { id: true, canonicalUrl: true, contentHash: true, version: true },
    });
    const decision = decideCollectedDocument(existing, { canonicalUrl, contentHash });
    if (decision.action === "SKIP") continue;
    const links = classifyCollectedDocument(document, {
      products: vocabulary[0].map((item) => ({ id: item.id, aliases: [item.brand, item.molecule] })),
      competitors: vocabulary[1].map((item) => ({ id: item.id, aliases: [item.name, item.molecule ?? ""] })),
      therapeuticAreas: [...new Set(vocabulary[0].map((item) => item.therapeuticCategory))]
        .map((name) => ({ name, aliases: [name] })),
    });
    if (input.productId && !links.productIds.includes(input.productId)) links.productIds.push(input.productId);
    const configuredType = source.topicTypes.split(",").find((type) => INTELLIGENCE_TYPES.includes(type.trim() as never))?.trim() ?? "INDUSTRY_NEWS";
    await prisma.salesIntelligence.create({
      data: {
        type: configuredType,
        title: document.title.trim(),
        summary: document.excerpt.trim().slice(0, 500) || document.title.trim(),
        contentExcerpt: document.excerpt.trim().slice(0, 2_000) || null,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: document.sourceUrl,
        canonicalUrl,
        publishedAt: document.publishedAt && !Number.isNaN(new Date(document.publishedAt).getTime()) ? new Date(document.publishedAt) : null,
        verificationStatus: initialVerification(source),
        confidence: source.trustLevel === "AUTHORITATIVE" ? "HIGH" : source.trustLevel === "TRUSTED" ? "MEDIUM" : "LOW",
        contentHash,
        version: decision.version,
        supersedesId: decision.action === "VERSION" ? decision.supersedesId : null,
        products: { create: links.productIds.map((productId) => ({ productId })) },
        competitors: { create: links.competitorIds.map((competitorId) => ({ competitorId })) },
        therapeuticAreas: { create: links.therapeuticAreas.map((name) => ({ name })) },
      },
    });
    if (decision.action === "VERSION") updatedCount += 1;
    else newCount += 1;
  }

  const completed = await prisma.collectionRun.update({
    where: { id: run.id },
    data: {
      status: result.status,
      finishedAt: new Date(),
      foundCount: result.documents.length,
      newCount,
      updatedCount,
      failedCount,
      errorSummary: result.failures.map((item) => `${item.sourceId}: ${item.message}`).join("; ").slice(0, 1_000) || null,
    },
  });
  await prisma.intelligenceSource.updateMany({
    where: { id: { in: sources.map((item) => item.id) } },
    data: { lastCollectedAt: new Date() },
  });
  return NextResponse.json({ ...completed, replayed: false }, { status: 201 });
}

export { collectionInput };
