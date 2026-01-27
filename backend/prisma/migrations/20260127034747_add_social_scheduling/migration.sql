-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budget" DOUBLE PRECISION,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_sources" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_analysis" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "summary" TEXT,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_assets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "content" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "username" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT[],
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "postedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "campaigns_userId_idx" ON "campaigns"("userId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaign_sources_campaignId_idx" ON "campaign_sources"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_analysis_campaignId_idx" ON "campaign_analysis"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_analysis_analysisType_idx" ON "campaign_analysis"("analysisType");

-- CreateIndex
CREATE INDEX "generated_assets_campaignId_idx" ON "generated_assets"("campaignId");

-- CreateIndex
CREATE INDEX "generated_assets_assetType_idx" ON "generated_assets"("assetType");

-- CreateIndex
CREATE INDEX "generated_assets_status_idx" ON "generated_assets"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- CreateIndex
CREATE INDEX "social_connections_userId_idx" ON "social_connections"("userId");

-- CreateIndex
CREATE INDEX "social_connections_platform_idx" ON "social_connections"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_userId_platform_key" ON "social_connections"("userId", "platform");

-- CreateIndex
CREATE INDEX "scheduled_posts_userId_idx" ON "scheduled_posts"("userId");

-- CreateIndex
CREATE INDEX "scheduled_posts_assetId_idx" ON "scheduled_posts"("assetId");

-- CreateIndex
CREATE INDEX "scheduled_posts_socialConnectionId_idx" ON "scheduled_posts"("socialConnectionId");

-- CreateIndex
CREATE INDEX "scheduled_posts_scheduledFor_idx" ON "scheduled_posts"("scheduledFor");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_idx" ON "scheduled_posts"("status");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_sources" ADD CONSTRAINT "campaign_sources_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_analysis" ADD CONSTRAINT "campaign_analysis_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_assets" ADD CONSTRAINT "generated_assets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "generated_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "social_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
