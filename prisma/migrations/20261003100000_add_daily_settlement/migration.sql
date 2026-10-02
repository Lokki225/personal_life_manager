-- AlterTable
ALTER TABLE "User" ADD COLUMN     "settledThrough" TIMESTAMP(3),
ADD COLUMN     "bufferSweepDay" INTEGER NOT NULL DEFAULT 0;
