/*
  Warnings:

  - You are about to drop the `FinancialGoal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Saving` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ChestType" AS ENUM ('AVAILABLE', 'SECURE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('DAILY_SAVING', 'PLANNED_SAVING', 'BUFFER_CONSOLIDATION', 'GOAL_FUNDING', 'WITHDRAWAL', 'EXPENSE');

-- CreateEnum
CREATE TYPE "GoalLogic" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('GTE', 'LTE', 'EQ', 'GT', 'LT');

-- CreateEnum
CREATE TYPE "EvalPeriod" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- DropForeignKey
ALTER TABLE "FinancialGoal" DROP CONSTRAINT "FinancialGoal_userId_fkey";

-- DropForeignKey
ALTER TABLE "Saving" DROP CONSTRAINT "Saving_userId_fkey";

-- DropTable
DROP TABLE "FinancialGoal";

-- DropTable
DROP TABLE "Saving";

-- CreateTable
CREATE TABLE "Chest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChestType" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyMovement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceChestId" TEXT,
    "destinationChestId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "MovementType" NOT NULL,
    "reason" "MovementReason" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "relatedGoalId" TEXT,
    "relatedProjectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'finance',
    "logic" "GoalLogic" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalCondition" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "measurement" TEXT NOT NULL,
    "chestId" TEXT,
    "operator" "ConditionOperator" NOT NULL,
    "targetValue" DECIMAL(65,30) NOT NULL,
    "unit" TEXT,
    "period" "EvalPeriod" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "GoalCondition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Chest" ADD CONSTRAINT "Chest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_sourceChestId_fkey" FOREIGN KEY ("sourceChestId") REFERENCES "Chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_destinationChestId_fkey" FOREIGN KEY ("destinationChestId") REFERENCES "Chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_relatedGoalId_fkey" FOREIGN KEY ("relatedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_relatedProjectId_fkey" FOREIGN KEY ("relatedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCondition" ADD CONSTRAINT "GoalCondition_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCondition" ADD CONSTRAINT "GoalCondition_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "Chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
