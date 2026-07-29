CREATE TABLE "McpServiceToken" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "tokenPrefix" TEXT NOT NULL DEFAULT 'phmcp_live_',
  "tokenHint" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "expiresAt" DATETIME, "lastUsedAt" DATETIME, "lastUsedIp" TEXT,
  "createdByEmployeeId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME, "revokedByEmployeeId" TEXT
);
CREATE UNIQUE INDEX "McpServiceToken_tokenHash_key" ON "McpServiceToken"("tokenHash");
CREATE INDEX "McpServiceToken_status_createdAt_idx" ON "McpServiceToken"("status","createdAt");
