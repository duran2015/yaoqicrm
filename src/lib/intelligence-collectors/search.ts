import type { IntelligenceCollector } from "../intelligence-collector";

type SearchResult = { title?: string; url?: string; snippet?: string; publishedAt?: string };

export const searchCollector: IntelligenceCollector = {
  async collect({ source, limit }) {
    const endpoint = process.env.INTELLIGENCE_SEARCH_ENDPOINT;
    const apiKey = process.env.INTELLIGENCE_SEARCH_API_KEY;
    if (!endpoint || !apiKey) return [];
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("搜索服务必须使用 HTTPS");
    url.searchParams.set("q", source.baseUrl ?? "");
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}`, "user-agent": "PharmaCRM-Intelligence/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`搜索服务 HTTP ${response.status}`);
    const payload = await response.json() as { results?: SearchResult[] };
    return (payload.results ?? []).slice(0, limit).flatMap((item) =>
      item.title && item.url
        ? [{ title: item.title, sourceUrl: item.url, excerpt: item.snippet ?? "", publishedAt: item.publishedAt ?? null }]
        : [],
    );
  },
};
