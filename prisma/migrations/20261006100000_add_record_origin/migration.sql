-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "origin" TEXT;

-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN "origin" TEXT;

-- AlterTable
ALTER TABLE "BudgetException" ADD COLUMN "origin" TEXT;
