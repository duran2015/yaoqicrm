CREATE TABLE "AgentEvaluationCase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "toolName" TEXT,
  "inputJson" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AgentEvaluationCase_key_key" ON "AgentEvaluationCase"("key");
CREATE INDEX "AgentEvaluationCase_enabled_sortOrder_idx" ON "AgentEvaluationCase"("enabled", "sortOrder");

CREATE TABLE "AgentEvaluationRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "scope" TEXT NOT NULL DEFAULT 'ALL',
  "mcpEndpoint" TEXT NOT NULL,
  "startedByEmployeeId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "caseCount" INTEGER NOT NULL DEFAULT 0,
  "passedCaseCount" INTEGER NOT NULL DEFAULT 0,
  "assertionCount" INTEGER NOT NULL DEFAULT 0,
  "passedAssertionCount" INTEGER NOT NULL DEFAULT 0,
  "averageLatencyMs" INTEGER,
  "errorMessage" TEXT
);
CREATE INDEX "AgentEvaluationRun_status_startedAt_idx" ON "AgentEvaluationRun"("status", "startedAt");

CREATE TABLE "AgentEvaluationResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "caseName" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "latencyMs" INTEGER,
  "httpStatus" INTEGER,
  "requestSummary" TEXT NOT NULL,
  "responseSummary" TEXT,
  "errorMessage" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  CONSTRAINT "AgentEvaluationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentEvaluationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgentEvaluationResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AgentEvaluationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AgentEvaluationResult_runId_status_idx" ON "AgentEvaluationResult"("runId", "status");
CREATE INDEX "AgentEvaluationResult_caseKey_startedAt_idx" ON "AgentEvaluationResult"("caseKey", "startedAt");

CREATE TABLE "AgentEvaluationAssertion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "resultId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "passed" BOOLEAN NOT NULL,
  "expected" TEXT NOT NULL,
  "actual" TEXT NOT NULL,
  CONSTRAINT "AgentEvaluationAssertion_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AgentEvaluationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AgentEvaluationAssertion_resultId_passed_idx" ON "AgentEvaluationAssertion"("resultId", "passed");
