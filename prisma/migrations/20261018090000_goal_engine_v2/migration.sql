-- CreateEnum
CREATE TYPE "ConditionLevel" AS ENUM ('REQUIRED', 'PREFERRED', 'INFO');

-- CreateEnum
CREATE TYPE "AchievementMode" AS ENUM ('AUTO', 'CONFIRM');

-- CreateEnum
CREATE TYPE "GoalImportance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('SELF', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "JudgementResult" AS ENUM ('MET', 'GAP', 'UNKNOWN');

-- AlterEnum
ALTER TYPE "ConditionOperator" ADD VALUE 'IN';

-- AlterEnum
ALTER TYPE "JournalType" ADD VALUE 'CAREER_LOG';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "achievementMode" "AchievementMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "importance" "GoalImportance",
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "why" TEXT;

-- AlterTable
ALTER TABLE "Condition" ADD COLUMN     "acceptedValues" JSONB,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "level" "ConditionLevel" NOT NULL DEFAULT 'REQUIRED',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "staleAfterDays" INTEGER;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN     "focusWeek" TIMESTAMP(3),
ADD COLUMN     "relatedId" TEXT,
ADD COLUMN     "relatedType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "careerLocations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "notifyCareer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reviewDay" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "ConditionJudgement" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL DEFAULT 'SELF',
    "subjectId" TEXT,
    "result" "JudgementResult" NOT NULL,
    "note" TEXT,
    "judgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionJudgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConditionJudgement_conditionId_subjectType_subjectId_judged_idx" ON "ConditionJudgement"("conditionId", "subjectType", "subjectId", "judgedAt");

-- CreateIndex
CREATE INDEX "Task_userId_domain_focusWeek_idx" ON "Task"("userId", "domain", "focusWeek");

-- AddForeignKey
ALTER TABLE "ConditionJudgement" ADD CONSTRAINT "ConditionJudgement_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

