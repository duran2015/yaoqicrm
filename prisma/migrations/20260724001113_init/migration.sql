-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "phone" TEXT,
    "reportsToId" TEXT,
    "territoryId" TEXT,
    CONSTRAINT "Employee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Territory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT,
    "address" TEXT,
    "territoryId" TEXT,
    CONSTRAINT "Hco_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hcp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "specialty" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'C',
    "hcoId" TEXT,
    "phone" TEXT,
    "wechat" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    CONSTRAINT "Hcp_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "molecule" TEXT NOT NULL,
    "therapeuticCategory" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "price" REAL,
    "unit" TEXT
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "hcpId" TEXT,
    "hcoId" TEXT,
    "visitDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "outcome" TEXT,
    "duration" INTEGER,
    "notes" TEXT,
    "nextStep" TEXT,
    "aiSummary" TEXT,
    "aiSentiment" TEXT,
    "jointWithId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visit_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "feedback" TEXT,
    CONSTRAINT "VisitProduct_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisitProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TourPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approverId" TEXT,
    "approvedAt" DATETIME,
    "rejectReason" TEXT,
    CONSTRAINT "TourPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TourPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tourPlanId" TEXT NOT NULL,
    "planDate" DATETIME NOT NULL,
    "hcpId" TEXT,
    "hcoName" TEXT,
    "note" TEXT,
    CONSTRAINT "TourPlanItem_tourPlanId_fkey" FOREIGN KEY ("tourPlanId") REFERENCES "TourPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TourPlanItem_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "totalQty" INTEGER NOT NULL,
    CONSTRAINT "SampleLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hcpId" TEXT,
    "visitId" TEXT,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "transDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleTransaction_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "SampleLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SampleTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SampleTransaction_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SampleTransaction_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "location" TEXT,
    "budget" REAL
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "hcpId" TEXT NOT NULL,
    CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MedEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventAttendance_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT,
    "period" TEXT NOT NULL,
    "visitTarget" INTEGER NOT NULL,
    "salesTarget" REAL,
    CONSTRAINT "Target_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Target_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
