-- AlterEnum
ALTER TYPE "MovementReason" ADD VALUE 'CHEST_SPENDING';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "paidFromChestId" TEXT,
ADD COLUMN "paidFromChestName" TEXT;

-- AlterTable
ALTER TABLE "MoneyMovement" ADD COLUMN "expenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_expenseId_key" ON "MoneyMovement"("expenseId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidFromChestId_fkey" FOREIGN KEY ("paidFromChestId") REFERENCES "Chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
