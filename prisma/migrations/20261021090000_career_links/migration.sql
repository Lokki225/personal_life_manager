-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "careerPromptAnsweredAt" TIMESTAMP(3),
ADD COLUMN     "careerRelevant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedGoalId" TEXT;

