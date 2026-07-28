CREATE TABLE "CyclePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "frequencyA" INTEGER NOT NULL DEFAULT 4,
    "frequencyB" INTEGER NOT NULL DEFAULT 2,
    "frequencyC" INTEGER NOT NULL DEFAULT 1,
    "frequencyD" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CyclePlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CyclePlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CyclePlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cyclePlanId" TEXT NOT NULL,
    "hcpId" TEXT NOT NULL,
    "tierSnapshot" TEXT NOT NULL,
    "targetVisits" INTEGER NOT NULL,
    CONSTRAINT "CyclePlanItem_cyclePlanId_fkey" FOREIGN KEY ("cyclePlanId") REFERENCES "CyclePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CyclePlanItem_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CyclePlan_employeeId_month_key" ON "CyclePlan"("employeeId", "month");
CREATE INDEX "CyclePlan_month_status_idx" ON "CyclePlan"("month", "status");
CREATE UNIQUE INDEX "CyclePlanItem_cyclePlanId_hcpId_key" ON "CyclePlanItem"("cyclePlanId", "hcpId");
CREATE INDEX "CyclePlanItem_hcpId_idx" ON "CyclePlanItem"("hcpId");
