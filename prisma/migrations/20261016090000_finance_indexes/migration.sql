-- CreateIndex
CREATE INDEX "MoneyMovement_userId_date_idx" ON "MoneyMovement"("userId", "date");

-- CreateIndex
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");

-- CreateIndex
CREATE INDEX "BudgetException_userId_date_idx" ON "BudgetException"("userId", "date");

