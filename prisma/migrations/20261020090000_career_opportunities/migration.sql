-- CreateEnum
CREATE TYPE "CareerOpportunityKind" AS ENUM ('JOB', 'PROMOTION', 'FREELANCE', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "CareerOpportunityStatus" AS ENUM ('FOUND', 'APPLIED', 'INTERVIEWING', 'OFFER', 'CLOSED');

-- CreateTable
CREATE TABLE "CareerOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation" TEXT,
    "kind" "CareerOpportunityKind" NOT NULL DEFAULT 'JOB',
    "sourceUrl" TEXT,
    "notes" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "CareerOpportunityStatus" NOT NULL DEFAULT 'FOUND',
    "outcome" TEXT,
    "monthlyCompensation" DECIMAL(65,30),
    "workArrangement" TEXT,
    "contractType" TEXT,
    "weeklyHours" INTEGER,
    "location" TEXT,
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerOpportunityGoal" (
    "opportunityId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,

    CONSTRAINT "CareerOpportunityGoal_pkey" PRIMARY KEY ("opportunityId","goalId")
);

-- CreateTable
CREATE TABLE "CareerStatusChange" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "status" "CareerOpportunityStatus" NOT NULL,
    "outcome" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerOpportunity_userId_status_idx" ON "CareerOpportunity"("userId", "status");

-- CreateIndex
CREATE INDEX "CareerOpportunityGoal_goalId_idx" ON "CareerOpportunityGoal"("goalId");

-- CreateIndex
CREATE INDEX "CareerStatusChange_opportunityId_changedAt_idx" ON "CareerStatusChange"("opportunityId", "changedAt");

-- AddForeignKey
ALTER TABLE "CareerOpportunity" ADD CONSTRAINT "CareerOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerOpportunityGoal" ADD CONSTRAINT "CareerOpportunityGoal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CareerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerOpportunityGoal" ADD CONSTRAINT "CareerOpportunityGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerStatusChange" ADD CONSTRAINT "CareerStatusChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CareerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

