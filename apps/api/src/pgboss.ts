import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';
import { TrendAnalyzer } from './trend-analyzer';
import { processEntry } from './entry-processor';
import { db } from './db';
import { entries } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { fetchNewData } from './services/miniflux/fetcher';
import { storeProcessedData, type StoredEntry } from './services/miniflux/storeData';
import invariant from 'tiny-invariant';


invariant(process.env.MINIFLUX_API_KEY, 'MINIFLUX_API_KEY is not set');
invariant(process.env.MINIFLUX_API_URL, 'MINIFLUX_API_URL is not set');

const SYNC_JOB_NAME = 'miniflux-sync';
const SUMMARIZE_ENTRY_JOB_NAME = 'summarize-entry';

let boss: PgBoss;
const trendAnalyzer = new TrendAnalyzer();

const SUMMARY_BATCH_SIZE = 10;
const SUMMARY_INTERVAL_MINUTES = 5;
const MINIFLUX_SYNC_INTERVAL_MINUTES = 10;
// API rate limit constants
const REQUESTS_PER_MINUTE = 15;
const REQUESTS_PER_DAY = 1500;
const TOKENS_PER_MINUTE = 1000000;

let tokenUsageLastMinute = 0;
let lastMinuteReset = Date.now();

// Adjust these values based on your average token usage per request
const ESTIMATED_TOKENS_PER_REQUEST = 1000;

// Min(15 requests per minute, 1000) = 15
const SUMMARIZE_RATE_LIMIT = Math.min(REQUESTS_PER_MINUTE, Math.floor(TOKENS_PER_MINUTE / ESTIMATED_TOKENS_PER_REQUEST));
const SUMMARIZE_RATE_LIMIT_INTERVAL = 60 * 1000; // 60 seconds in milliseconds

// Daily limit tracker
let dailyRequestCount = 0;
const DAILY_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Reset daily count every 24 hours
setInterval(() => {
  dailyRequestCount = 0;
}, DAILY_RESET_INTERVAL);

const pgbossConfig = {
  connectionString: process.env.DATABASE_URL as string,
  // ULID configuration
  uuid: () => ulid(),
  helloPubsub: {
    idColumnType: 'text'
  },

  // Queue options
  archiveCompletedAfterSeconds: 60 * 60 * 24, // 1 day
  archiveFailedAfterSeconds: 60 * 60 * 24 * 7, // 1 week

  // Scheduling options
  clockMonitorIntervalSeconds: 60, // Check for clock skew every minute
  timeZone: 'UTC', // Adjust if needed

  // Maintenance options
  maintenanceIntervalSeconds: 60, // Run maintenance every minute

  // Expiration options
  expireInSeconds: 30 * 60, // Jobs expire after 30 minutes if not completed

  // Retention options
  retentionDays: 30, // Keep completed jobs for 30 days

  // Retry options
  retryLimit: 5, // Retry failed jobs 5 times
  retryDelay: 30, // Wait 30 seconds between retries
  retryBackoff: true, // Use exponential backoff for retries

  // Job polling options
  newJobCheckInterval: 1000, // Check for new jobs every second

  // Additional options
  max: 10, // Maximum number of connections in the pool

  // Logging (if you want to integrate with your logging system)
  onComplete: (job: any) => logger.info(`Job completed: ${job.id}`),
  onFail: (job: any, error: any) => logger.error(`Job failed: ${job.id}`, error)
};

export async function initializePgBoss() {
  try {
    boss = new PgBoss(pgbossConfig);

    boss.on('error', error => logger.error('PgBoss error:', error));
    boss.on('wip', ([job]) => logger.info(`Job in progress: ${job.id}`));
    boss.on('monitor-states', (monitorStates) => {
      logger.info('PgBoss monitor states:', JSON.stringify(monitorStates, null, 2));
    });
    boss.on('stopped', () => logger.info('PgBoss stopped'));

    await boss.start();
    logger.info('PgBoss initialized and started');

    await initializeQueues();
    logger.info('All job handlers set up');

  } catch (error) {
    logger.error('Error initializing PgBoss:', error);
    throw error;
  }
}

async function initializeQueues() {
  const requiredQueues = [
    'analyze-trends-hourly',
    'analyze-trends-daily',
    'analyze-trends-weekly',
    'queue-entries-for-summaries',
    'summarize-entry',
    SYNC_JOB_NAME
  ];

  const existingQueues = await boss.getQueues();
  console.debug('Existing queues:', existingQueues);
  const queuesToCreate = requiredQueues.filter(queue => !existingQueues.map(q => q.name).includes(queue));

  for (const queue of queuesToCreate) {
    try {
      await boss.createQueue(queue);
      logger.info(`Created queue: ${queue}`);
    } catch (error) {
      logger.warn(`Failed to create queue ${queue}, it may already exist`, error);
    }
  }

  await setupTrendAnalysisJobs();
  await setupEntrySummarizationJobs();
  await setupMinifluxSync(MINIFLUX_SYNC_INTERVAL_MINUTES);
}

async function setupTrendAnalysisJobs() {
  // Hourly trend processing
  logger.debug('Setting up trend analysis queue');
  await boss.schedule('analyze-trends-hourly', '0 * * * *');

  logger.debug('Setting up trend analysis jobs');
  await boss.work('analyze-trends-hourly', async ([job]) => {
    logger.info(`Running hourly trend processing job ${job.id}`);
    const unprocessedEntries = await db.select({ id: entries.id })
      .from(entries)
      .where(eq(entries.processedForTrends, false))
      .orderBy(entries.id);

    if (unprocessedEntries.length > 0) {
      const startId = unprocessedEntries[0].id;
      const endId = unprocessedEntries[unprocessedEntries.length - 1].id;
      await boss.send('process-entry-batch-for-trends', { startId, endId });
    }

    logger.info(`Completed hourly trend processing job ${job.id}`);
    return { success: true, processedCount: unprocessedEntries.length };
  });

  await boss.work<{ startId: string, endId: string }>('analyze-trends-hourly', async ([job]) => {
    const { startId, endId } = job.data;
    logger.info(`Processing trend batch job ${job.id} for entries ${startId} to ${endId}`);

    await trendAnalyzer.processBatch(startId, endId);

    logger.info(`Completed trend batch job ${job.id}`);
    return { success: true };
  });

  // Daily trend analysis
  logger.debug('Setting up daily trend analysis queue');
  await boss.schedule('analyze-trends-daily', '0 0 * * *');
  logger.debug('Setting up daily trend analysis job');
  await boss.work('analyze-trends-daily', async ([job]) => {
    logger.info(`Running daily trend analysis job ${job.id}`);
    const recentTrends = await trendAnalyzer.getDailyTrends();
    const bursts = await trendAnalyzer.detectBursts();
    logger.info(`Completed daily trend analysis job ${job.id}`);
    return { success: true, recentTrends, bursts };
  });

  // Weekly trend analysis
  logger.debug('Setting up weekly trend analysis queue');
  await boss.schedule('analyze-trends-weekly', '0 0 * * 0');
  logger.debug('Setting up weekly trend analysis job');
  await boss.work('analyze-trends-weekly', async ([job]) => {
    logger.info(`Running weekly trend analysis job ${job.id}`);
    const weeklyTrends = await trendAnalyzer.getWeeklyTrends();
    logger.info(`Completed weekly trend analysis job ${job.id}`);
    return { success: true, weeklyTrends };
  });
}

async function setupEntrySummarizationJobs() {
  // Queue entries for summarization every 5 minutes
  logger.debug('Setting up entry summarization queue');
  await boss.schedule('queue-entries-for-summaries', `*/${SUMMARY_INTERVAL_MINUTES} * * * *`);

  // Summarize entries with rate limiting
  logger.debug('Setting up summarize entry job with rate limiting');

  await boss.work('queue-entries-for-summaries', async ([job]) => {
    logger.info(`Running entry summarization queueing job ${job.id}`);
    const unprocessedEntries = await db.select({ id: entries.id, content: entries.content })
      .from(entries)
      .where(eq(entries.processedForSummary, false))
      .orderBy(entries.id)
      .limit(SUMMARY_BATCH_SIZE);

    for (const entry of unprocessedEntries) {
      await boss.send('summarize-entry', { entryId: entry.id, content: entry.content }, {
        singletonKey: `summarize-entry-${entry.id}`,
        singletonSeconds: 60 * 60, // Prevent re-processing for 1 hour
        retryLimit: 3,
        retryDelay: SUMMARIZE_RATE_LIMIT_INTERVAL / SUMMARIZE_RATE_LIMIT,
        retryBackoff: true
      });
    }

    logger.info(`Queued ${unprocessedEntries.length} entries for summarization`);
    return { success: true, queuedCount: unprocessedEntries.length };
  });

  await boss.work<{ entryId: string, content: string }>('summarize-entry', { batchSize: SUMMARIZE_RATE_LIMIT }, async ([job]) => {
    const { entryId, content } = job.data;
    logger.info(`Processing summary for entry ${entryId}`);

    try {
      // Check if the entry has already been processed
      const existingEntry = await db.select({ processedForSummary: entries.processedForSummary })
        .from(entries)
        .where(eq(entries.id, entryId))
        .limit(1);

      if (existingEntry[0]?.processedForSummary) {
        logger.info(`Entry ${entryId} has already been processed. Skipping.`);
        return { success: true, entryId, alreadyProcessed: true };
      }

      // Check daily limit
      if (dailyRequestCount >= REQUESTS_PER_DAY) {
        logger.warn('Daily request limit reached. Skipping job.');
        return { success: false, entryId, error: 'Daily request limit reached' };
      }

      // Check and reset per-minute token usage
      const now = Date.now();
      if (now - lastMinuteReset > 60000) {
        tokenUsageLastMinute = 0;
        lastMinuteReset = now;
      }

      // Estimate token usage
      const estimatedTokens = content.split(/\s+/).length * 1.3;

      if (tokenUsageLastMinute + estimatedTokens > TOKENS_PER_MINUTE) {
        logger.warn('Token per minute limit reached. Failing job to retry later.');
        return { success: false, entryId, error: 'Rate limit reached' };
      }

      dailyRequestCount++;
      tokenUsageLastMinute += estimatedTokens;

      const summaryResult = await processEntry(content);
      if (summaryResult instanceof Error) {
        logger.error(`Error processing summary for entry ${entryId}:`, summaryResult);
        return { success: false, entryId, error: summaryResult.message };
      }

      // Update the entry in the database with the summary
      await db.update(entries)
        .set({
          summary: summaryResult.summary,
          keypoints: summaryResult.keypoints,
          takeaways: summaryResult.takeaways,
          processedForSummary: true
        })
        .where(eq(entries.id, entryId));

      logger.info(`Completed summary for entry ${entryId}`);
      return { success: true, entryId, summarized: true };
    } catch (error) {
      logger.error(`Unexpected error processing summary for entry ${entryId}:`, error);
      return { success: false, entryId, error: 'Unexpected error occurred' };
    }
  });
}

async function setupMinifluxSync(intervalMinutes: number) {
  // Schedule the recurring sync job
  logger.debug('Setting up miniflux sync queue');
  await boss.schedule(SYNC_JOB_NAME, `*/${intervalMinutes} * * * *`);

  // Set up the work handler for the sync job
  await boss.work(SYNC_JOB_NAME, async ([job]) => {
    logger.info(`Starting Miniflux sync job ${job.id}`);

    try {
      const { allFeeds, newEntries } = await fetchNewData();

      logger.info(`Fetched ${allFeeds.length} new feeds and ${newEntries.length} new entries`);

      // Store new entries in the database first
      const { entries } = await storeProcessedData(allFeeds, newEntries);

      if (Array.isArray(entries)) {
        logger.info(`Queueing ${entries.length} entries for summarization`);
        for (const entry of entries) {
          const id = await boss.send({
            name: SUMMARIZE_ENTRY_JOB_NAME,
            data: {
              entryId: entry.id, // This is now the database ULID
              content: entry.content
            }
          });
          logger.debug(`Queued entry for summarization: ${entry.id} with job id ${id}`);
        }
      } else {
        logger.warn(`entries is not an array`, typeof entries);
      }

      logger.info(`Miniflux sync job ${job.id} completed successfully`);
      return { success: true, newFeedsCount: allFeeds.length, newEntriesCount: newEntries.length };
    } catch (error) {
      logger.error(`Error during Miniflux sync job ${job.id}`, { error });
      throw error; // This will mark the job as failed in pg-boss
    }
  });

  logger.info(`Miniflux sync job scheduled to run every ${intervalMinutes} minutes`);

  // Optionally, run an initial sync immediately
  await boss.send({ name: SYNC_JOB_NAME });
}

export async function queueEntryBatchForTrendProcessing(startId: number, endId: number) {
  const jobId = await boss.send('analyze-trends-hourly', { startId, endId });
  logger.info(`Queued trend batch job ${jobId} for entries ${startId} to ${endId}`);
  return jobId;
}

// export async function processNewEntries(newEntries: any[]) {
//   const batchSize = 100; // Adjust as needed for trend analysis
//   for (let i = 0; i < newEntries.length; i += batchSize) {
//     const batchEntries = newEntries.slice(i, i + batchSize);
//     const startId = batchEntries[0].id;
//     const endId = batchEntries[batchEntries.length - 1].id;
//     await queueEntryBatchForTrendProcessing(startId, endId);
//   }

//   // Queue entries for summarization
//   for (const entry of newEntries) {
//     await boss.send('summarize-entry', { entryId: entry.id, content: entry.content });
//   }
// }


