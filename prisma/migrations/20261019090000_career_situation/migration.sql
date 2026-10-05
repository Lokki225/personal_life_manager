-- CreateEnum
CREATE TYPE "CareerFactKind" AS ENUM ('POSITION', 'QUALIFICATION', 'SKILL', 'EXPERIENCE');

-- CreateEnum
CREATE TYPE "CareerFactSource" AS ENUM ('SELF', 'DOCUMENTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "CareerFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CareerFactKind" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "source" "CareerFactSource" NOT NULL DEFAULT 'SELF',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastReviewedAt" TIMESTAMP(3),
    "organisation" TEXT,
    "monthlyCompensation" DECIMAL(65,30),
    "workArrangement" TEXT,
    "contractType" TEXT,
    "weeklyHours" INTEGER,
    "location" TEXT,
    "financeIncomeId" TEXT,
    "issuer" TEXT,
    "obtainedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "level" TEXT,
    "positionId" TEXT,
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerEvidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" TEXT,

    CONSTRAINT "CareerEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerEvidenceLink" (
    "evidenceId" TEXT NOT NULL,
    "factId" TEXT NOT NULL,

    CONSTRAINT "CareerEvidenceLink_pkey" PRIMARY KEY ("evidenceId","factId")
);

-- CreateIndex
CREATE INDEX "CareerFact_userId_kind_idx" ON "CareerFact"("userId", "kind");

-- CreateIndex
CREATE INDEX "CareerEvidence_userId_idx" ON "CareerEvidence"("userId");

-- CreateIndex
CREATE INDEX "CareerEvidenceLink_factId_idx" ON "CareerEvidenceLink"("factId");

-- AddForeignKey
ALTER TABLE "CareerFact" ADD CONSTRAINT "CareerFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEvidence" ADD CONSTRAINT "CareerEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEvidenceLink" ADD CONSTRAINT "CareerEvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "CareerEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerEvidenceLink" ADD CONSTRAINT "CareerEvidenceLink_factId_fkey" FOREIGN KEY ("factId") REFERENCES "CareerFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

