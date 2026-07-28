-- CreateTable
CREATE TABLE "McpOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "entityType" TEXT,
    "entityId" TEXT,
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "McpOperation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "McpOperation_employeeId_toolName_idempotencyKey_key"
ON "McpOperation"("employeeId", "toolName", "idempotencyKey");

-- CreateIndex
CREATE INDEX "McpOperation_createdAt_idx" ON "McpOperation"("createdAt");

-- CreateIndex
CREATE INDEX "McpOperation_employeeId_status_createdAt_idx"
ON "McpOperation"("employeeId", "status", "createdAt");
