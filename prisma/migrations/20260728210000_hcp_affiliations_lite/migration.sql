CREATE TABLE "HcpAffiliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcpId" TEXT NOT NULL,
    "hcoId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "title" TEXT,
    "adminDuty" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HcpAffiliation_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HcpAffiliation_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "HcpAffiliation" (
    "id", "hcpId", "hcoId", "departmentName", "title", "adminDuty",
    "isPrimary", "effectiveDate", "createdAt", "updatedAt"
)
SELECT
    'aff-' || "id", "id", "hcoId", COALESCE(NULLIF(TRIM("specialty"), ''), '未设置科室'),
    "title", "adminDuty", true, '2025-01-01 00:00:00 +08:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Hcp"
WHERE "hcoId" IS NOT NULL;

CREATE UNIQUE INDEX "HcpAffiliation_hcpId_hcoId_departmentName_effectiveDate_key"
ON "HcpAffiliation"("hcpId", "hcoId", "departmentName", "effectiveDate");

CREATE INDEX "HcpAffiliation_hcpId_isPrimary_idx" ON "HcpAffiliation"("hcpId", "isPrimary");
CREATE INDEX "HcpAffiliation_hcoId_idx" ON "HcpAffiliation"("hcoId");
