import { parseHTML } from "linkedom";
import type { IntelligenceCollector } from "../intelligence-collector";

type HtmlConfig = {
  itemSelector: string;
  titleSelector: string;
  linkSelector: string;
  excerptSelector?: string;
  dateSelector?: string;
};

export const htmlListCollector: IntelligenceCollector = {
  async collect({ source, limit }) {
    if (!source.baseUrl) throw new Error("列表来源缺少地址");
    const url = new URL(source.baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("列表来源必须使用 HTTP(S)");
    const config = JSON.parse(source.configJson ?? "{}") as Partial<HtmlConfig>;
    if (!config.itemSelector || !config.titleSelector || !config.linkSelector) throw new Error("列表来源选择器不完整");
    const response = await fetch(url, {
      headers: { "user-agent": "PharmaCRM-Intelligence/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`列表页 HTTP ${response.status}`);
    const html = await response.text();
    if (Buffer.byteLength(html) > 2_000_000) throw new Error("列表页响应过大");
    const { document } = parseHTML(html);
    return [...document.querySelectorAll(config.itemSelector)].slice(0, limit).flatMap((item) => {
      const title = item.querySelector(config.titleSelector!)?.textContent?.trim();
      const href = item.querySelector(config.linkSelector!)?.getAttribute("href");
      if (!title || !href) return [];
      const sourceUrl = new URL(href, url).toString();
      const excerpt = config.excerptSelector ? item.querySelector(config.excerptSelector)?.textContent?.trim() ?? "" : "";
      const publishedAt = config.dateSelector ? item.querySelector(config.dateSelector)?.textContent?.trim() ?? null : null;
      return [{ title, sourceUrl, excerpt, publishedAt }];
    });
  },
};
