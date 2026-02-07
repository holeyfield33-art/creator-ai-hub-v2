import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifySupabaseToken } from '../lib/supabase';

const prisma = new PrismaClient();

interface DashboardQuery {
  days?: string;
  platform?: string;
}

interface CampaignAnalyticsParams {
  id: string;
}

interface CampaignAnalyticsQuery {
  days?: string;
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /api/analytics/dashboard - Overview metrics for user
  fastify.get('/api/analytics/dashboard', async (request: FastifyRequest<{ Querystring: DashboardQuery }>, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    // Get or create user
    const user = await prisma.users.upsert({
      where: { id: supabaseUser.id },
      update: {},
      create: {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.name,
        password: '',
      },
    });

    // Parse query parameters
    const { days = '30', platform } = request.query as { days?: string; platform?: string };
    const daysAgo = parseInt(days, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Build platform filter
    const platformFilter = platform ? { platform } : {};

    // Get scheduled posts with metrics
    const posts = await prisma.scheduled_posts.findMany({
      where: {
        userId: user.id,
        status: 'posted',
        postedAt: { gte: startDate },
        ...platformFilter,
      },
      include: {
        post_metrics: true,
      },
    });

    // Calculate totals
    const totalPosts = posts.length;
    let totalImpressions = 0;
    let totalEngagements = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalComments = 0;

    posts.forEach((post) => {
      post.post_metrics.forEach((metric) => {
        totalImpressions += metric.impressions;
        totalEngagements += metric.engagements;
        totalLikes += metric.likes;
        totalShares += metric.shares;
        totalComments += metric.comments;
      });
    });

    const avgEngagementRate = totalImpressions > 0 
      ? (totalEngagements / totalImpressions) * 100 
      : 0;

    // Get platform breakdown
    interface PlatformMetrics {
      platform: string;
      posts: number;
      impressions: number;
      engagements: number;
    }
    const platformBreakdown: Record<string, PlatformMetrics> = {};
    posts.forEach((post) => {
      if (!platformBreakdown[post.platform]) {
        platformBreakdown[post.platform] = {
          platform: post.platform,
          posts: 0,
          impressions: 0,
          engagements: 0,
        };
      }
      platformBreakdown[post.platform].posts += 1;
      post.post_metrics.forEach((metric) => {
        platformBreakdown[post.platform].impressions += metric.impressions;
        platformBreakdown[post.platform].engagements += metric.engagements;
      });
    });

    // Get daily metrics for chart
    interface DailyMetrics {
      date: string;
      impressions: number;
      engagements: number;
    }
    const dailyMetrics: Record<string, DailyMetrics> = {};
    posts.forEach((post) => {
      post.post_metrics.forEach((metric) => {
        const date = post.postedAt?.toISOString().split('T')[0] || '';
        if (!dailyMetrics[date]) {
          dailyMetrics[date] = {
            date,
            impressions: 0,
            engagements: 0,
          };
        }
        dailyMetrics[date].impressions += metric.impressions;
        dailyMetrics[date].engagements += metric.engagements;
      });
    });

    const dailyData = Object.values(dailyMetrics).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Get top campaigns
    const campaigns = await prisma.campaigns.findMany({
      where: { userId: user.id },
      include: {
        generated_assets: {
          include: {
            scheduled_posts: {
              where: {
                status: 'posted',
                postedAt: { gte: startDate },
              },
              include: { post_metrics: true },
            },
          },
        },
      },
    });

    const campaignMetrics = campaigns.map((campaign) => {
      let posts = 0;
      let impressions = 0;
      let engagements = 0;

      campaign.generated_assets.forEach((asset) => {
        asset.scheduled_posts.forEach((post) => {
          posts += 1;
          post.post_metrics.forEach((metric) => {
            impressions += metric.impressions;
            engagements += metric.engagements;
          });
        });
      });

      return {
        id: campaign.id,
        name: campaign.name,
        posts,
        impressions,
        engagements,
        engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
      };
    }).filter((c) => c.posts > 0).sort((a, b) => b.engagements - a.engagements).slice(0, 5);

    return reply.send({
      overview: {
        totalPosts,
        totalImpressions,
        totalEngagements,
        avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
        totalLikes,
        totalShares,
        totalComments,
      },
      platformBreakdown: Object.values(platformBreakdown),
      dailyMetrics: dailyData,
      topCampaigns: campaignMetrics,
    });
  });

  // GET /api/analytics/campaigns/:id/metrics - Campaign-specific metrics
  fastify.get<{ Params: CampaignAnalyticsParams; Querystring: CampaignAnalyticsQuery }>(
    '/api/analytics/campaigns/:id/metrics',
    async (request: FastifyRequest<{ Params: CampaignAnalyticsParams }>, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const token = authHeader.substring(7);
      const supabaseUser = await verifySupabaseToken(token);
      if (!supabaseUser) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      const user = await prisma.users.upsert({
        where: { id: supabaseUser.id },
        update: {},
        create: {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.name,
          password: '',
        },
      });

      const { id: campaignId } = request.params;

      // Verify campaign ownership
      const campaign = await prisma.campaigns.findFirst({
        where: {
          id: campaignId,
          userId: user.id,
        },
      });

      if (!campaign) {
        return reply.status(404).send({ error: 'Campaign not found' });
      }

      // Get posts with metrics
      const assets = await prisma.generated_assets.findMany({
        where: { campaignId },
        include: {
          scheduled_posts: {
            where: { status: 'posted' },
            include: {
              post_metrics: {
                orderBy: { fetchedAt: 'desc' },
                take: 1, // Get most recent metrics
              },
            },
          },
        },
      });

      const posts = assets.flatMap((asset) =>
        asset.scheduled_posts.map((post) => ({
          id: post.id,
          platform: post.platform,
          content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          postedAt: post.postedAt,
          platformPostId: post.platformPostId,
          metrics: post.post_metrics[0] || null,
        }))
      );

      // Calculate totals
      let totalImpressions = 0;
      let totalEngagements = 0;
      let totalLikes = 0;
      let totalShares = 0;
      let totalComments = 0;

      posts.forEach((post) => {
        if (post.metrics) {
          totalImpressions += post.metrics.impressions;
          totalEngagements += post.metrics.engagements;
          totalLikes += post.metrics.likes;
          totalShares += post.metrics.shares;
          totalComments += post.metrics.comments;
        }
      });

      const avgEngagementRate = totalImpressions > 0 
        ? (totalEngagements / totalImpressions) * 100 
        : 0;

      return reply.send({
        summary: {
          totalPosts: posts.length,
          totalImpressions,
          totalEngagements,
          avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
          totalLikes,
          totalShares,
          totalComments,
        },
        posts: posts.sort((a, b) => {
          const aEng = a.metrics?.engagements || 0;
          const bEng = b.metrics?.engagements || 0;
          return bEng - aEng;
        }),
      });
    }
  );

  // POST /api/analytics/refresh - Trigger metrics collection
  fastify.post('/api/analytics/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const user = await prisma.users.upsert({
      where: { id: supabaseUser.id },
      update: {},
      create: {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.name,
        password: '',
      },
    });

    // Get posted posts without recent metrics (older than 1 hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const posts = await prisma.scheduled_posts.findMany({
      where: {
        userId: user.id,
        status: 'posted',
        platformPostId: { not: null },
      },
      include: {
        post_metrics: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
    });

    const postsNeedingMetrics = posts.filter((post) => {
      if (post.post_metrics.length === 0) return true;
      const lastFetch = post.post_metrics[0].fetchedAt;
      return lastFetch < oneHourAgo;
    });

    // Create collect_metrics jobs
    const jobs = await Promise.all(
      postsNeedingMetrics.map((post) =>
        prisma.jobs.create({
          data: {
            type: 'collect_metrics',
            status: 'pending',
            payload: { scheduledPostId: post.id },
          },
        })
      )
    );

    return reply.send({
      message: 'Metrics collection triggered',
      jobsCreated: jobs.length,
    });
  });
}
