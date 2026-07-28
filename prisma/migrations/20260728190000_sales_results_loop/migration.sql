CREATE TABLE "SalesImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL,
    "failedRows" INTEGER NOT NULL,
    "errorSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SalesResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" DATETIME NOT NULL,
    "productId" TEXT NOT NULL,
    "hcoId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "targetAmountCents" INTEGER NOT NULL,
    "actualAmountCents" INTEGER NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesResult_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesResult_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesResult_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "SalesImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SalesImportBatch_createdAt_idx" ON "SalesImportBatch"("createdAt");
CREATE UNIQUE INDEX "SalesResult_month_productId_hcoId_employeeId_key" ON "SalesResult"("month", "productId", "hcoId", "employeeId");
CREATE INDEX "SalesResult_month_idx" ON "SalesResult"("month");
