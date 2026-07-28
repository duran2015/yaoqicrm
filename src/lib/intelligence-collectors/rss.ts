import { DOMParser } from "linkedom";
import type { IntelligenceCollector } from "../intelligence-collector";

const MAX_RESPONSE_BYTES = 2_000_000;

export const rssCollector: IntelligenceCollector = {
  async collect({ source, limit }) {
    if (!source.baseUrl) throw new Error("RSS 来源缺少地址");
    const url = new URL(source.baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("RSS 来源必须使用 HTTP(S)");
    const response = await fetch(url, {
      headers: { "user-agent": "PharmaCRM-Intelligence/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    const xml = await response.text();
    if (Buffer.byteLength(xml) > MAX_RESPONSE_BYTES) throw new Error("RSS 响应过大");
    const document = new DOMParser().parseFromString(xml, "text/xml");
    const entries = [...document.querySelectorAll("item, entry")].slice(0, limit);
    return entries.flatMap((entry) => {
      const title = entry.querySelector("title")?.textContent?.trim();
      const linkElement = entry.querySelector("link");
      const sourceUrl = linkElement?.getAttribute("href") ?? linkElement?.textContent?.trim();
      if (!title || !sourceUrl) return [];
      const excerpt = entry.querySelector("description, summary, content")?.textContent?.trim() ?? "";
      const publishedAt = entry.querySelector("pubDate, published, updated")?.textContent?.trim() ?? null;
      return [{ title, sourceUrl, excerpt, publishedAt }];
    });
  },
};
