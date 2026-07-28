CREATE TABLE "AccountPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcoId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "businessGoal" TEXT NOT NULL,
    "situation" TEXT,
    "strategy" TEXT NOT NULL,
    "successCriteria" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountPlan_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AccountPlanProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountPlanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "AccountPlanProduct_accountPlanId_fkey" FOREIGN KEY ("accountPlanId") REFERENCES "AccountPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountPlanProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AccountStakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountPlanId" TEXT NOT NULL,
    "hcpId" TEXT NOT NULL,
    "decisionRole" TEXT NOT NULL,
    "attitude" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "AccountStakeholder_accountPlanId_fkey" FOREIGN KEY ("accountPlanId") REFERENCES "AccountPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountStakeholder_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AccountMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" DATETIME,
    "followUpTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountMilestone_accountPlanId_fkey" FOREIGN KEY ("accountPlanId") REFERENCES "AccountPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountMilestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountMilestone_followUpTaskId_fkey" FOREIGN KEY ("followUpTaskId") REFERENCES "FollowUpTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountPlan_hcoId_year_key" ON "AccountPlan"("hcoId", "year");
CREATE INDEX "AccountPlan_ownerId_year_status_idx" ON "AccountPlan"("ownerId", "year", "status");
CREATE UNIQUE INDEX "AccountPlanProduct_accountPlanId_productId_key" ON "AccountPlanProduct"("accountPlanId", "productId");
CREATE UNIQUE INDEX "AccountStakeholder_accountPlanId_hcpId_key" ON "AccountStakeholder"("accountPlanId", "hcpId");
CREATE INDEX "AccountStakeholder_hcpId_idx" ON "AccountStakeholder"("hcpId");
CREATE UNIQUE INDEX "AccountMilestone_followUpTaskId_key" ON "AccountMilestone"("followUpTaskId");
CREATE INDEX "AccountMilestone_accountPlanId_status_dueDate_idx" ON "AccountMilestone"("accountPlanId", "status", "dueDate");
CREATE INDEX "AccountMilestone_ownerId_status_dueDate_idx" ON "AccountMilestone"("ownerId", "status", "dueDate");
