-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('FREE', 'DAILY', 'DECISION', 'IDEA', 'REVIEW');

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "JournalType" NOT NULL DEFAULT 'FREE',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "mood" INTEGER,
    "energy" INTEGER,
    "isSecured" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "reviewOn" TIMESTAMP(3),
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLink" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "JournalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_entryDate_idx" ON "JournalEntry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalLink_targetType_targetId_idx" ON "JournalLink"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "JournalLink_entryId_idx" ON "JournalLink"("entryId");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLink" ADD CONSTRAINT "JournalLink_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

