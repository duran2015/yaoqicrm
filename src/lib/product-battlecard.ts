type BattlecardIntelligence = {
  id: string;
  type: string;
  title: string;
  summary: string;
  verificationStatus: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | Date | null;
  collectedAt: string | Date;
};

type BattlecardMaterial = {
  id: string;
  title: string;
  version: string;
  approvalCode: string | null;
  externalUrl: string;
};

export function buildProductBattlecard(input: {
  product: { id: string; brand: string; molecule: string; therapeuticCategory: string };
  intelligence: BattlecardIntelligence[];
  approvedMaterials: BattlecardMaterial[];
}) {
  const citationById = new Map(input.intelligence.map((item) => [item.id, {
    intelligenceId: item.id,
    title: item.title,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt,
    verificationStatus: item.verificationStatus,
  }]));
  const fact = (item: BattlecardIntelligence) => ({
    intelligenceId: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    citationId: item.id,
  });
  const verifiedFacts = input.intelligence.filter((item) => item.verificationStatus === "VERIFIED").map(fact);
  const pendingLeads = input.intelligence.filter((item) => item.verificationStatus === "PENDING_REVIEW").map(fact);
  return {
    product: input.product,
    verifiedFacts,
    pendingLeads,
    approvedMaterials: input.approvedMaterials,
    preparationQuestions: verifiedFacts.slice(0, 5).map((item) => `围绕“${item.title}”了解客户当前做法、关注点和未满足需求。`),
    citations: [...citationById.values()],
    warnings: verifiedFacts.length ? [] : ["未找到该产品的已核验情报"],
    complianceNotice: "政策、竞品与知识内容仅供内部参考；对外沟通仅使用当前有效且已批准的产品材料。",
  };
}
