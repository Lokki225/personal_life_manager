-- AlterTable
ALTER TABLE "MetricSeries" ADD COLUMN     "connectorId" TEXT;

-- CreateTable
CREATE TABLE "SyncConnector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountRef" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncConnector_userId_idx" ON "SyncConnector"("userId");

-- AddForeignKey
ALTER TABLE "MetricSeries" ADD CONSTRAINT "MetricSeries_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "SyncConnector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConnector" ADD CONSTRAINT "SyncConnector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

