CREATE TABLE "ProductMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "messageSummary" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "approvalCode" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "VisitMaterialUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "versionSnapshot" TEXT NOT NULL,
    "approvalCodeSnapshot" TEXT NOT NULL,
    CONSTRAINT "VisitMaterialUsage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisitMaterialUsage_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "ProductMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductMaterial_productId_version_key" ON "ProductMaterial"("productId", "version");
CREATE INDEX "ProductMaterial_productId_status_effectiveDate_expiryDate_idx" ON "ProductMaterial"("productId", "status", "effectiveDate", "expiryDate");
CREATE UNIQUE INDEX "VisitMaterialUsage_visitId_materialId_key" ON "VisitMaterialUsage"("visitId", "materialId");
