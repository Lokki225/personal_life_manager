-- The shared goal engine: a goal's conditions move from the flat Finance
-- "GoalCondition" table into condition groups, so every node uses one model.
-- Existing goals are copied first, then the old table is dropped. Goal ids do
-- not change, so debts and money movements keep pointing at their goals.

-- CreateEnum
CREATE TYPE "GoalLifecycle" AS ENUM ('TERMINAL', 'ONGOING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "GoalHorizon" AS ENUM ('WEEK', 'QUARTER', 'YEAR', 'SOMEDAY');

-- CreateEnum
CREATE TYPE "ConditionRole" AS ENUM ('COMPLETION', 'HEALTH');

-- CreateEnum
CREATE TYPE "Aggregation" AS ENUM ('LATEST', 'SUM', 'COUNT', 'MAX', 'MIN', 'AVG', 'STREAK', 'RATIO');

-- AlterTable
ALTER TABLE "Goal"
ADD COLUMN     "abandonReason" TEXT,
ADD COLUMN     "abandonedAt" TIMESTAMP(3),
ADD COLUMN     "achievedAt" TIMESTAMP(3),
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "horizon" "GoalHorizon" NOT NULL DEFAULT 'SOMEDAY',
ADD COLUMN     "latch" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lifecycle" "GoalLifecycle" NOT NULL DEFAULT 'TERMINAL',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ConditionGroup" (
    "id" TEXT NOT NULL,
    "goalId" TEXT,
    "milestoneId" TEXT,
    "parentGroupId" TEXT,
    "logic" "GoalLogic" NOT NULL DEFAULT 'ALL',
    "role" "ConditionRole" NOT NULL DEFAULT 'COMPLETION',

    CONSTRAINT "ConditionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" JSONB NOT NULL DEFAULT '{}',
    "aggregation" "Aggregation" NOT NULL,
    "window" JSONB NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "target" DECIMAL(65,30) NOT NULL,
    "unit" TEXT,
    "floor" DECIMAL(65,30),
    "stretch" DECIMAL(65,30),

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConditionGroup_goalId_idx" ON "ConditionGroup"("goalId");

-- CreateIndex
CREATE INDEX "ConditionGroup_milestoneId_idx" ON "ConditionGroup"("milestoneId");

-- CreateIndex
CREATE INDEX "Condition_groupId_idx" ON "Condition"("groupId");

-- CreateIndex
CREATE INDEX "Milestone_goalId_idx" ON "Milestone"("goalId");

-- AddForeignKey
ALTER TABLE "ConditionGroup" ADD CONSTRAINT "ConditionGroup_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionGroup" ADD CONSTRAINT "ConditionGroup_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionGroup" ADD CONSTRAINT "ConditionGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "ConditionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConditionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --- Copy the existing Finance goals ----------------------------------------

-- Existing goals keep behaving as before: no latching, started when created.
-- A goal about exceptions in a month is a habit that never ends.
UPDATE "Goal" g
SET "startDate" = g."createdAt",
    "latch" = false,
    "lifecycle" = CASE
      WHEN EXISTS (
        SELECT 1 FROM "GoalCondition" gc
        WHERE gc."goalId" = g.id AND gc.measurement <> 'chest_balance'
      ) THEN 'ONGOING'::"GoalLifecycle"
      ELSE 'TERMINAL'::"GoalLifecycle"
    END;

-- One completion group per goal, with the goal's ALL / ANY.
INSERT INTO "ConditionGroup" (id, "goalId", logic, role)
SELECT 'grp_' || g.id, g.id, g.logic, 'COMPLETION'::"ConditionRole"
FROM "Goal" g;

-- An unknown measurement gives a NULL source, which fails the copy instead of
-- losing a condition.
INSERT INTO "Condition" (id, "groupId", source, "sourceRef", aggregation, "window", operator, target, unit)
SELECT
  gc.id,
  'grp_' || gc."goalId",
  CASE gc.measurement
    WHEN 'chest_balance' THEN 'CHEST_BALANCE'
    WHEN 'monthly_deviation_count' THEN 'BUDGET_EXCEPTIONS'
    WHEN 'monthly_deviation_amount' THEN 'BUDGET_EXCEPTIONS'
  END,
  CASE WHEN gc."chestId" IS NOT NULL THEN jsonb_build_object('chestId', gc."chestId") ELSE '{}'::jsonb END,
  CASE gc.measurement
    WHEN 'chest_balance' THEN 'LATEST'::"Aggregation"
    WHEN 'monthly_deviation_count' THEN 'COUNT'::"Aggregation"
    WHEN 'monthly_deviation_amount' THEN 'SUM'::"Aggregation"
  END,
  CASE gc.measurement
    WHEN 'chest_balance' THEN '{"type":"ALL_TIME"}'::jsonb
    ELSE '{"type":"CALENDAR","unit":"month"}'::jsonb
  END,
  gc.operator,
  gc."targetValue",
  gc.unit
FROM "GoalCondition" gc;

-- --- Remove the old model ----------------------------------------------------

-- DropForeignKey
ALTER TABLE "GoalCondition" DROP CONSTRAINT "GoalCondition_goalId_fkey";

-- DropForeignKey
ALTER TABLE "GoalCondition" DROP CONSTRAINT "GoalCondition_chestId_fkey";

-- DropTable
DROP TABLE "GoalCondition";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "logic";

-- DropEnum
DROP TYPE "EvalPeriod";
