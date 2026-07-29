export interface EvaluationAssertion {
  key: string;
  label: string;
  required: boolean;
  passed: boolean;
  expected: string;
  actual: string;
}

export const FIXED_EVALUATION_CASES = [
  ["protocol.initialize", "MCP 初始化", "PROTOCOL"],
  ["protocol.tools-list", "工具发现", "PROTOCOL"],
  ["identity.missing-jwt", "缺少 JWT", "IDENTITY"],
  ["identity.expired-jwt", "过期 JWT", "IDENTITY"],
  ["identity.employee-mismatch", "员工映射不一致", "IDENTITY"],
  ["intelligence.search", "销售情报搜索", "INTELLIGENCE_SEARCH"],
  ["battlecard.product", "产品战卡", "PRODUCT_BATTLECARD"],
  ["refresh.confirmation", "刷新确认保护", "INTELLIGENCE_REFRESH"],
  ["refresh.idempotency", "刷新幂等与审计", "INTELLIGENCE_REFRESH"],
].map(([key, name, capability], sortOrder) => ({
  key, name, capability, sortOrder, required: true, enabled: true,
  description: `确定性验证：${name}`, toolName: key.includes(".") ? key.split(".")[0] : null,
  inputJson: "{}",
}));

const assertion = (key: string, label: string, passed: boolean, expected: string, actual: string): EvaluationAssertion =>
  ({ key, label, required: true, passed, expected, actual });

export function evaluateToolDiscovery(names: string[]) {
  const required = ["search_sales_intelligence", "get_product_battlecard", "refresh_product_intelligence"];
  return [assertion("tools.required", "发现三个销售情报复合工具", required.every((name) => names.includes(name)), required.join(", "), names.join(", "))];
}

export function evaluateSearchResult(data: unknown, limit: number) {
  const items = Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: Record<string, unknown>[] }).items : [];
  const bounded = items.length <= limit;
  const cited = items.length > 0 && items.every((item) =>
    Boolean(item.title && item.sourceName && typeof item.sourceUrl === "string" && /^https?:\/\//.test(item.sourceUrl)));
  return [
    assertion("search.bounded", "结果数量不超过上限", bounded, `<= ${limit}`, String(items.length)),
    assertion("search.citations", "正式结果均有来源引用", cited, "每条包含标题、来源和 HTTP(S) 链接", cited ? "全部具备" : "存在缺失"),
  ];
}

export function evaluateBattlecardResult(data: unknown) {
  const card = data as Record<string, unknown>;
  const product = card?.product as Record<string, unknown> | undefined;
  const groups = ["verifiedFacts", "pendingLeads", "approvedMaterials"].every((key) => Array.isArray(card?.[key]));
  const facts = (card?.verifiedFacts ?? []) as Record<string, unknown>[];
  const materials = (card?.approvedMaterials ?? []) as Record<string, unknown>[];
  const citations = facts.every((item) => /^https?:\/\//.test(String(item.sourceUrl ?? "")))
    && materials.every((item) => /^https?:\/\//.test(String(item.externalUrl ?? "")));
  return [
    assertion("battlecard.product", "返回产品身份", Boolean(product?.name || product?.brand), "包含产品名称", String(product?.name ?? product?.brand ?? "缺失")),
    assertion("battlecard.groups", "事实、线索和材料分组明确", groups, "三个数组分组", groups ? "完整" : "缺失"),
    assertion("battlecard.citations", "事实和材料可追溯", citations, "全部包含 HTTP(S) 引用", citations ? "全部具备" : "存在缺失"),
  ];
}
