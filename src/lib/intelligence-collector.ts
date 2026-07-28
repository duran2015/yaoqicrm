export type CollectedDocument = {
  title: string;
  sourceUrl: string;
  excerpt: string;
  publishedAt: Date | string | null;
};

export type CollectorSource = {
  id: string;
  collectionType: string;
  enabled: boolean;
  baseUrl?: string;
  configJson?: string | null;
};

export interface IntelligenceCollector {
  collect(input: {
    source: CollectorSource;
    limit: number;
  }): Promise<CollectedDocument[]>;
}

type CollectionFailure = { sourceId: string; message: string };

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "未知采集错误";
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, sourceId: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`来源 ${sourceId} 采集超时`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function collectEnabledSources(
  input: {
    sources: CollectorSource[];
    limitPerSource: number;
    timeoutMs: number;
  },
  collectors: Record<string, IntelligenceCollector>,
) {
  const enabled = input.sources.filter((source) => source.enabled);
  const results = await Promise.all(enabled.map(async (source) => {
    const collector = collectors[source.collectionType];
    if (!collector) return {
      documents: [] as CollectedDocument[],
      failure: { sourceId: source.id, message: `不支持采集类型 ${source.collectionType}` },
    };
    try {
      const documents = await withTimeout(
        collector.collect({ source, limit: input.limitPerSource }),
        input.timeoutMs,
        source.id,
      );
      return { documents: documents.slice(0, input.limitPerSource), failure: null };
    } catch (cause) {
      return {
        documents: [] as CollectedDocument[],
        failure: { sourceId: source.id, message: errorMessage(cause) },
      };
    }
  }));

  const failures = results.map((item) => item.failure).filter((item): item is CollectionFailure => Boolean(item));
  return {
    status: failures.length === 0 ? "SUCCEEDED" as const : failures.length === enabled.length ? "FAILED" as const : "PARTIAL" as const,
    documents: results.flatMap((item) => item.documents),
    failures,
  };
}

export function initialVerification(source: { sourceType: string; trustLevel: string }) {
  return source.sourceType === "OFFICIAL" && source.trustLevel === "AUTHORITATIVE"
    ? "VERIFIED" as const
    : "PENDING_REVIEW" as const;
}
