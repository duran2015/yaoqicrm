-- AlterTable
ALTER TABLE "Hco" ADD COLUMN "code" TEXT;

-- AlterTable
ALTER TABLE "Hcp" ADD COLUMN "code" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "checkinTime" DATETIME NOT NULL,
    "locationName" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT NOT NULL DEFAULT 'NORMAL',
    CONSTRAINT "CheckIn_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckIn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "phone" TEXT,
    "reportsToId" TEXT,
    "territoryId" TEXT,
    "departmentId" TEXT,
    CONSTRAINT "Employee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("division", "id", "name", "phone", "reportsToId", "role", "territoryId") SELECT "division", "id", "name", "phone", "reportsToId", "role", "territoryId" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE TABLE "new_Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "hcpId" TEXT,
    "hcoId" TEXT,
    "visitDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "purposes" TEXT,
    "outcome" TEXT,
    "duration" INTEGER,
    "notes" TEXT,
    "summary" TEXT,
    "nextStep" TEXT,
    "aiSummary" TEXT,
    "aiSentiment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "receiverId" TEXT,
    "validityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "evaluatedById" TEXT,
    "evaluatedAt" DATETIME,
    "invalidReason" TEXT,
    "jointWithId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visit_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Visit" ("aiSentiment", "aiSummary", "createdAt", "duration", "employeeId", "hcoId", "hcpId", "id", "jointWithId", "nextStep", "notes", "outcome", "purpose", "type", "updatedAt", "visitDate") SELECT "aiSentiment", "aiSummary", "createdAt", "duration", "employeeId", "hcoId", "hcpId", "id", "jointWithId", "nextStep", "notes", "outcome", "purpose", "type", "updatedAt", "visitDate" FROM "Visit";
DROP TABLE "Visit";
ALTER TABLE "new_Visit" RENAME TO "Visit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Hco_code_key" ON "Hco"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Hcp_code_key" ON "Hcp"("code");
