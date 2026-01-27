-- CreateTable
CREATE TABLE "post_metrics" (
    "id" TEXT NOT NULL,
    "scheduledPostId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementRate" DOUBLE PRECISION DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_metrics_scheduledPostId_idx" ON "post_metrics"("scheduledPostId");

-- CreateIndex
CREATE INDEX "post_metrics_platform_idx" ON "post_metrics"("platform");

-- CreateIndex
CREATE INDEX "post_metrics_fetchedAt_idx" ON "post_metrics"("fetchedAt");

-- CreateIndex
CREATE INDEX "campaign_metrics_campaignId_idx" ON "campaign_metrics"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_metrics_periodStart_periodEnd_idx" ON "campaign_metrics"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_scheduledPostId_fkey" FOREIGN KEY ("scheduledPostId") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
