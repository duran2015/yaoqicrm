import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function parseSource(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || !item.name.trim() || typeof item.baseUrl !== "string") return null;
  try {
    const url = new URL(item.baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  const sourceTypes = ["OFFICIAL", "PROFESSIONAL", "COMPANY", "MEDIA", "SEARCH"];
  const collectionTypes = ["RSS", "LIST_PAGE", "SEARCH", "MANUAL"];
  const trustLevels = ["AUTHORITATIVE", "TRUSTED", "REFERENCE"];
  if (!sourceTypes.includes(String(item.sourceType)) || !collectionTypes.includes(String(item.collectionType)) || !trustLevels.includes(String(item.trustLevel))) return null;
  return {
    name: item.name.trim(),
    baseUrl: item.baseUrl,
    sourceType: String(item.sourceType),
    collectionType: String(item.collectionType),
    trustLevel: String(item.trustLevel),
    topicTypes: typeof item.topicTypes === "string" ? item.topicTypes : "",
    configJson: typeof item.configJson === "string" ? item.configJson : null,
    enabled: item.enabled !== false,
  };
}

export async function GET() {
  return NextResponse.json(await prisma.intelligenceSource.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }] }));
}

export async function POST(req: NextRequest) {
  const input = parseSource(await req.json().catch(() => null));
  if (!input) return err("来源配置不合法");
  return NextResponse.json(await prisma.intelligenceSource.create({ data: input }), { status: 201 });
}
