-- AlterTable
ALTER TABLE "BudgetException" ADD COLUMN     "expenseId" TEXT;

-- AddForeignKey
ALTER TABLE "BudgetException" ADD CONSTRAINT "BudgetException_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
