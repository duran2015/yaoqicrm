import { Prisma } from "@prisma/client";

/** 拜访标准 include:列表/详情/评定接口共用,保证返回结构一致 */
export const visitInclude = {
  employee: { select: { id: true, name: true, role: true, division: true } },
  receiver: { select: { id: true, name: true, role: true } },
  evaluatedBy: { select: { id: true, name: true, role: true } },
  hcp: { select: { id: true, code: true, name: true, title: true, specialty: true, tier: true } },
  hco: { select: { id: true, code: true, name: true, type: true, level: true } },
  products: { include: { product: { select: { id: true, brand: true, molecule: true } } } },
  samples: { include: { lot: { include: { product: { select: { id: true, brand: true } } } } } },
  checkins: { orderBy: { checkinTime: "asc" as const } },
} satisfies Prisma.VisitInclude;
