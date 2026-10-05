-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('SOFTWARE', 'MUSIC', 'WRITING', 'TRAINING', 'DESIGN', 'BUSINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'SHIPPED', 'MAINTAINED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReleaseKind" AS ENUM ('VERSION', 'SINGLE', 'ALBUM', 'PUBLICATION', 'DEPLOYMENT', 'MILESTONE', 'OTHER');

-- AlterEnum
ALTER TYPE "JournalType" ADD VALUE 'PROJECT_LOG';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "lifeAreaId" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "originIdeaId" TEXT,
ADD COLUMN     "primaryDomain" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN     "publicSummary" TEXT,
ADD COLUMN     "showTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "CareerFact" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "ProjectLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStatusChange" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "from" "ProjectStatus",
    "to" "ProjectStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRelease" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ReleaseKind" NOT NULL DEFAULT 'VERSION',
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "url" TEXT,
    "retroWentWell" TEXT,
    "retroLearned" TEXT,
    "retroNext" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "publicNotes" TEXT,
    "showLearned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectLink_projectId_idx" ON "ProjectLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStatusChange_projectId_changedAt_idx" ON "ProjectStatusChange"("projectId", "changedAt");

-- CreateIndex
CREATE INDEX "ProjectRelease_projectId_releasedAt_idx" ON "ProjectRelease"("projectId", "releasedAt");

-- CreateIndex
CREATE INDEX "Project_userId_status_idx" ON "Project"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project"("userId", "slug");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_lifeAreaId_fkey" FOREIGN KEY ("lifeAreaId") REFERENCES "LifeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLink" ADD CONSTRAINT "ProjectLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStatusChange" ADD CONSTRAINT "ProjectStatusChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRelease" ADD CONSTRAINT "ProjectRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerFact" ADD CONSTRAINT "CareerFact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing Finance projects join the shared list: a URL name from the name
-- (with the end of the id, so it is unique), and their first status entry.
UPDATE "Project"
SET "slug" = trim(both '-' from left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 40)) || '-' || right("id", 6)
WHERE "slug" IS NULL;

INSERT INTO "ProjectStatusChange" ("id", "projectId", "from", "to", "changedAt")
SELECT md5(random()::text || p."id"), p."id", NULL, p."status", p."createdAt"
FROM "Project" p
WHERE NOT EXISTS (SELECT 1 FROM "ProjectStatusChange" c WHERE c."projectId" = p."id");
