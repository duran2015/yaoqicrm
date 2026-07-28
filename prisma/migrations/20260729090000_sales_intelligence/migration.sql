CREATE TABLE "IntelligenceSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trustLevel" TEXT NOT NULL,
    "topicTypes" TEXT NOT NULL,
    "configJson" TEXT,
    "lastCollectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CollectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggerType" TEXT NOT NULL,
    "sourceId" TEXT,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "requestedById" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntelligenceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CollectionRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CollectionRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CompetitorProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "molecule" TEXT,
    "company" TEXT,
    "therapeuticCategory" TEXT NOT NULL,
    "indications" TEXT,
    "websiteUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SalesIntelligence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentExcerpt" TEXT,
    "sourceId" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesIntelligence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntelligenceSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesIntelligence_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SalesIntelligence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesIntelligence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "IntelligenceProduct" (
    "intelligenceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    PRIMARY KEY ("intelligenceId", "productId"),
    CONSTRAINT "IntelligenceProduct_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "SalesIntelligence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IntelligenceTherapeuticArea" (
    "intelligenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    PRIMARY KEY ("intelligenceId", "name"),
    CONSTRAINT "IntelligenceTherapeuticArea_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "SalesIntelligence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IntelligenceCompetitor" (
    "intelligenceId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    PRIMARY KEY ("intelligenceId", "competitorId"),
    CONSTRAINT "IntelligenceCompetitor_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "SalesIntelligence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceCompetitor_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "CompetitorProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IntelligenceUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intelligenceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hcpId" TEXT,
    "productId" TEXT,
    "visitId" TEXT,
    "usageType" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceUsage_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "SalesIntelligence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceUsage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceUsage_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceUsage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "IntelligenceSource_enabled_sourceType_idx" ON "IntelligenceSource"("enabled", "sourceType");
CREATE UNIQUE INDEX "IntelligenceSource_baseUrl_collectionType_key" ON "IntelligenceSource"("baseUrl", "collectionType");
CREATE INDEX "CollectionRun_status_createdAt_idx" ON "CollectionRun"("status", "createdAt");
CREATE INDEX "CollectionRun_sourceId_createdAt_idx" ON "CollectionRun"("sourceId", "createdAt");
CREATE INDEX "CollectionRun_productId_createdAt_idx" ON "CollectionRun"("productId", "createdAt");
CREATE UNIQUE INDEX "CollectionRun_requestedById_triggerType_idempotencyKey_key" ON "CollectionRun"("requestedById", "triggerType", "idempotencyKey");
CREATE INDEX "CompetitorProduct_therapeuticCategory_active_idx" ON "CompetitorProduct"("therapeuticCategory", "active");
CREATE UNIQUE INDEX "CompetitorProduct_name_company_key" ON "CompetitorProduct"("name", "company");
CREATE INDEX "SalesIntelligence_contentHash_idx" ON "SalesIntelligence"("contentHash");
CREATE INDEX "SalesIntelligence_type_verificationStatus_publishedAt_idx" ON "SalesIntelligence"("type", "verificationStatus", "publishedAt");
CREATE INDEX "SalesIntelligence_validUntil_idx" ON "SalesIntelligence"("validUntil");
CREATE UNIQUE INDEX "SalesIntelligence_canonicalUrl_version_key" ON "SalesIntelligence"("canonicalUrl", "version");
CREATE INDEX "IntelligenceProduct_productId_idx" ON "IntelligenceProduct"("productId");
CREATE INDEX "IntelligenceTherapeuticArea_name_idx" ON "IntelligenceTherapeuticArea"("name");
CREATE INDEX "IntelligenceCompetitor_competitorId_idx" ON "IntelligenceCompetitor"("competitorId");
CREATE INDEX "IntelligenceUsage_employeeId_usedAt_idx" ON "IntelligenceUsage"("employeeId", "usedAt");
CREATE INDEX "IntelligenceUsage_intelligenceId_usageType_idx" ON "IntelligenceUsage"("intelligenceId", "usageType");
CREATE INDEX "IntelligenceUsage_hcpId_usedAt_idx" ON "IntelligenceUsage"("hcpId", "usedAt");
CREATE INDEX "IntelligenceUsage_productId_usedAt_idx" ON "IntelligenceUsage"("productId", "usedAt");
