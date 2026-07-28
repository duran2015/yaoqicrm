-- CreateTable
CREATE TABLE "HcpEducation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcpId" TEXT NOT NULL,
    "school" TEXT,
    "major" TEXT,
    "mentor" TEXT,
    "gradDate" TEXT,
    "degree" TEXT,
    "education" TEXT,
    CONSTRAINT "HcpEducation_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HcpBankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcpId" TEXT NOT NULL,
    "accountName" TEXT,
    "bankName" TEXT,
    "accountNo" TEXT,
    "accountType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HcpBankAccount_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HcoDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardName" TEXT,
    "feature" TEXT,
    "ranking" TEXT,
    "overview" TEXT,
    CONSTRAINT "HcoDepartment_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HcoProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "HcoProduct_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HcoProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HcoExamResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcoId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "score" REAL,
    "rank" INTEGER,
    CONSTRAINT "HcoExamResult_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerTierHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcpId" TEXT,
    "hcoId" TEXT,
    "fromTier" TEXT,
    "toTier" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerTierHistory_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerTierHistory_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hcpId" TEXT,
    "hcoId" TEXT,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAssignment_hcpId_fkey" FOREIGN KEY ("hcpId") REFERENCES "Hcp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerAssignment_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applicantId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    "rejectReason" TEXT,
    "targetHcpId" TEXT,
    "targetHcoId" TEXT,
    "createdHcpId" TEXT,
    "createdHcoId" TEXT,
    "pool" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Hco" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT,
    "address" TEXT,
    "territoryId" TEXT,
    "creditCode" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "otherNames" TEXT,
    "businessStatus" TEXT,
    "phone" TEXT,
    "businessAddress" TEXT,
    "category" TEXT,
    "regCapital" TEXT,
    "foundedDate" TEXT,
    "legalPerson" TEXT,
    "businessScope" TEXT,
    "website" TEXT,
    "introduction" TEXT,
    "hospitalNature" TEXT,
    "institutionType" TEXT,
    "isMilitary" TEXT,
    "isInsurance" TEXT,
    "isClinicalTrial" TEXT,
    "isHeadquarters" TEXT,
    "teachingType" TEXT,
    "diagnosisSubjects" TEXT,
    "icuBeds" INTEGER,
    "openBeds" INTEGER,
    "approvedBeds" INTEGER,
    "doctorCount" INTEGER,
    "annualDrugPurchase" REAL,
    "annualRevenue" REAL,
    "dailyOutpatient" INTEGER,
    "annualSurgeries" INTEGER,
    "annualAdmissions" INTEGER,
    "diseaseAreas" TEXT,
    "drugRatio" REAL,
    "isStrategic" TEXT,
    "cooperationStatus" TEXT,
    "tier" TEXT,
    "kaOwnerId" TEXT,
    CONSTRAINT "Hco_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Hco_kaOwnerId_fkey" FOREIGN KEY ("kaOwnerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hco" ("address", "code", "id", "level", "name", "territoryId", "type") SELECT "address", "code", "id", "level", "name", "territoryId", "type" FROM "Hco";
DROP TABLE "Hco";
ALTER TABLE "new_Hco" RENAME TO "Hco";
CREATE UNIQUE INDEX "Hco_code_key" ON "Hco"("code");
CREATE TABLE "new_Hcp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "specialty" TEXT,
    "tier" TEXT,
    "hcoId" TEXT,
    "phone" TEXT,
    "wechat" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "gender" TEXT,
    "birthday" TEXT,
    "licenseNo" TEXT,
    "adminDuty" TEXT,
    "academicTitle" TEXT,
    "doctorLevel" TEXT,
    "isMultiPractice" TEXT,
    "onlineConsult" TEXT,
    "isClinicalPI" TEXT,
    "isGroupLeader" TEXT,
    "isPharmacyCommittee" TEXT,
    "practiceScope" TEXT,
    "weeklyOutpatient" INTEGER,
    "managedBeds" INTEGER,
    "expertise" TEXT,
    "practiceCertNo" TEXT,
    "titleCertNo" TEXT,
    "email" TEXT,
    "hometown" TEXT,
    "hobbies" TEXT,
    "personalityTags" TEXT,
    "homeAddress" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    CONSTRAINT "Hcp_hcoId_fkey" FOREIGN KEY ("hcoId") REFERENCES "Hco" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Hcp" ("code", "hcoId", "id", "name", "notes", "phone", "specialty", "tags", "tier", "title", "wechat") SELECT "code", "hcoId", "id", "name", "notes", "phone", "specialty", "tags", "tier", "title", "wechat" FROM "Hcp";
DROP TABLE "Hcp";
ALTER TABLE "new_Hcp" RENAME TO "Hcp";
CREATE UNIQUE INDEX "Hcp_code_key" ON "Hcp"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
