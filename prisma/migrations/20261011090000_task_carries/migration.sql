-- CreateTable
CREATE TABLE "TaskCarry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "carriedTo" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCarry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskCarry_taskId_carriedTo_idx" ON "TaskCarry"("taskId", "carriedTo");

-- AddForeignKey
ALTER TABLE "TaskCarry" ADD CONSTRAINT "TaskCarry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

