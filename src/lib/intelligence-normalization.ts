import { createHash } from "node:crypto";

const TRACKING_KEYS = new Set(["spm", "from", "source"]);

export function canonicalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeIntelligenceText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function fingerprintIntelligence(value: string) {
  return createHash("sha256").update(normalizeIntelligenceText(value)).digest("hex");
}

type ExistingDocument = {
  id: string;
  canonicalUrl: string;
  contentHash: string;
  version: number;
};

export function decideCollectedDocument(
  existing: ExistingDocument[],
  incoming: { canonicalUrl: string; contentHash: string },
) {
  const sameContent = existing.find((item) => item.contentHash === incoming.contentHash);
  if (sameContent) return { action: "SKIP" as const, existingId: sameContent.id };
  const sameUrl = existing
    .filter((item) => item.canonicalUrl === incoming.canonicalUrl)
    .sort((a, b) => b.version - a.version)[0];
  if (sameUrl) return {
    action: "VERSION" as const,
    supersedesId: sameUrl.id,
    version: sameUrl.version + 1,
  };
  return { action: "CREATE" as const, version: 1 };
}

type AliasVocabulary = {
  products: Array<{ id: string; aliases: string[] }>;
  competitors: Array<{ id: string; aliases: string[] }>;
  therapeuticAreas: Array<{ name: string; aliases: string[] }>;
};

function containsAlias(text: string, aliases: string[]) {
  return aliases.some((alias) => alias.trim() && text.includes(normalizeIntelligenceText(alias)));
}

export function classifyCollectedDocument(
  document: { title: string; excerpt?: string | null },
  vocabulary: AliasVocabulary,
) {
  const text = normalizeIntelligenceText(`${document.title} ${document.excerpt ?? ""}`);
  return {
    productIds: vocabulary.products.filter((item) => containsAlias(text, item.aliases)).map((item) => item.id),
    competitorIds: vocabulary.competitors.filter((item) => containsAlias(text, item.aliases)).map((item) => item.id),
    therapeuticAreas: vocabulary.therapeuticAreas.filter((item) => containsAlias(text, item.aliases)).map((item) => item.name),
  };
}
