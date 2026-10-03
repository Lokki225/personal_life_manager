-- AlterTable
ALTER TABLE "User" ADD COLUMN "assistantName" TEXT,
ADD COLUMN "assistantInstructions" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
