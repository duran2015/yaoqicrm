ALTER TABLE "Visit" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUBMITTED';

ALTER TABLE "TourPlanItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "TourPlanItem" ADD COLUMN "visitId" TEXT;
CREATE UNIQUE INDEX "TourPlanItem_visitId_key" ON "TourPlanItem"("visitId");

ALTER TABLE "SampleTransaction" ADD COLUMN "reason" TEXT;
ALTER TABLE "SampleTransaction" ADD COLUMN "confirmedByHcp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SampleTransaction" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MedEvent" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "EventAttendance" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INVITED';
ALTER TABLE "EventAttendance" ADD COLUMN "checkedInAt" DATETIME;

CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" DATETIME,
    "assigneeId" TEXT NOT NULL,
    "hcpId" TEXT,
    "hcoId" TEXT,
    "sourceVisitId" TEXT,
    "sourceEventId" TEXT,
    "followUpVisitId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUpTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUpTask_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUpTask_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUpTask_sourceVisitId_fkey" FOREIGN KEY ("sourceVisitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUpTask_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "MedEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUpTask_followUpVisitId_fkey" FOREIGN KEY ("followUpVisitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FollowUpTask_followUpVisitId_key" ON "FollowUpTask"("followUpVisitId");
CREATE INDEX "FollowUpTask_assigneeId_status_dueDate_idx" ON "FollowUpTask"("assigneeId", "status", "dueDate");
CREATE INDEX "FollowUpTask_hcpId_status_idx" ON "FollowUpTask"("hcpId", "status");
CREATE INDEX "FollowUpTask_sourceEventId_status_idx" ON "FollowUpTask"("sourceEventId", "status");

CREATE TABLE "CoachingAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "managerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sourceVisitId" TEXT,
    "dueDate" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachingAction_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoachingAction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoachingAction_sourceVisitId_fkey" FOREIGN KEY ("sourceVisitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CoachingAction_managerId_status_idx" ON "CoachingAction"("managerId", "status");
CREATE INDEX "CoachingAction_employeeId_status_dueDate_idx" ON "CoachingAction"("employeeId", "status", "dueDate");
