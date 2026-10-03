-- AlterTable
ALTER TABLE "User" ADD COLUMN "assistantNotes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AssistantNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantNote_userId_createdAt_idx" ON "AssistantNote"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantNote" ADD CONSTRAINT "AssistantNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
