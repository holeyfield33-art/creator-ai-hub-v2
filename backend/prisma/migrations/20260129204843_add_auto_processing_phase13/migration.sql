-- AlterTable
ALTER TABLE "campaign_sources" ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'uploaded',
ADD COLUMN     "transcriptText" TEXT;

-- CreateTable
CREATE TABLE "usage_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quotaDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcriptionsUsed" INTEGER NOT NULL DEFAULT 0,
    "generationsUsed" INTEGER NOT NULL DEFAULT 0,
    "transcriptionsLimit" INTEGER NOT NULL DEFAULT 10,
    "generationsLimit" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_quotas_userId_idx" ON "usage_quotas"("userId");

-- CreateIndex
CREATE INDEX "usage_quotas_quotaDate_idx" ON "usage_quotas"("quotaDate");

-- CreateIndex
CREATE UNIQUE INDEX "usage_quotas_userId_quotaDate_key" ON "usage_quotas"("userId", "quotaDate");

-- CreateIndex
CREATE INDEX "campaign_sources_status_idx" ON "campaign_sources"("status");
