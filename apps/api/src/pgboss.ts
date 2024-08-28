import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';
import { TrendAnalyzer } from './trend-analyzer';
import { processEntry } from './entry-processor';
import { db } from './db';
import { entries } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { initializeMinifluxSync } from './services/miniflux/sync';
import { minifluxClient, MinifluxClient } from './services/miniflux/client';
import { fetchNewData } from './services/miniflux/fetcher';
import { storeProcessedData } from './services/miniflux/storeData';
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
  noSupervisor: false, // This instance will run maintenance
  max: 10, // Maximum number of connections in the pool

  // Logging (if you want to integrate with your logging system)
  onComplete: (job: any) => logger.info(`Job completed: ${job.id}`),
  onFail: (job: any, error: any) => logger.error(`Job failed: ${job.id}`, error)
};

export async function initializePgBoss() {
  try {
    boss = new PgBoss(pgbossConfig);

    boss.on('error', error => logger.error('PgBoss error:', error));
    boss.on('wip', (job: any) => logger.info(`Job in progress: ${job.id}`));
    boss.on('stopped', () => logger.info('PgBoss stopped'));


    await boss.start();
    logger.info('PgBoss initialized and started');

    await setupTrendAnalysisJobs();
    logger.info('Trend analysis jobs set up');

    await setupEntrySummarizationJobs();
    logger.info('Entry summarization jobs set up');

    await setupMinifluxSync(MINIFLUX_SYNC_INTERVAL_MINUTES);
    logger.info('Miniflux sync job set up');

    logger.info('All job handlers set up');

  } catch (error) {
    logger.error('Error initializing PgBoss:', error);
    throw error;
  }
}

async function setupTrendAnalysisJobs() {
  // Hourly trend processing
  logger.debug('Setting up trend analysis queue');
  await boss.createQueue('analyze-trends-hourly');

  logger.debug('Setting up trend analysis jobs');
  await boss.schedule('analyze-trends-hourly', '0 * * * *');


  // Daily trend analysis
  logger.debug('Setting up daily trend analysis queue');
  await boss.createQueue('analyze-trends-daily');
  logger.debug('Setting up daily trend analysis job');
  await boss.schedule('analyze-trends-daily', '0 0 * * *');


  // Weekly trend analysis
  logger.debug('Setting up weekly trend analysis queue');
  await boss.createQueue('analyze-trends-weekly');
  logger.debug('Setting up weekly trend analysis job');
  await boss.schedule('analyze-trends-weekly', '0 0 * * 0');

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

  await boss.work('analyze-trends-daily', async ([job]) => {
    logger.info(`Running daily trend analysis job ${job.id}`);
    const recentTrends = await trendAnalyzer.getDailyTrends();
    const bursts = await trendAnalyzer.detectBursts();
    logger.info(`Completed daily trend analysis job ${job.id}`);
    return { success: true, recentTrends, bursts };
  });

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
  await boss.createQueue('queue-entries-for-summaries');
  logger.debug('Setting up entry summarization job');
  await boss.schedule('queue-entries-for-summaries', `*/${SUMMARY_INTERVAL_MINUTES} * * * *`);

  // Summarize entries
  logger.debug('Setting up summarize entry job');
  await boss.createQueue('summarize-entry');

  await boss.work('queue-entries-for-summaries', async ([job]) => {
    logger.info(`Running entry summarization queueing job ${job.id}`);
    const unprocessedEntries = await db.select({ id: entries.id, content: entries.content })
      .from(entries)
      .where(eq(entries.processedForSummary, false))
      .orderBy(entries.id)
      .limit(SUMMARY_BATCH_SIZE);

    for (const entry of unprocessedEntries) {
      await boss.send('summarize-entry', { entryId: entry.id, content: entry.content });
    }

    logger.info(`Queued ${unprocessedEntries.length} entries for summarization`);
    return { success: true, queuedCount: unprocessedEntries.length };
  });

  await boss.work<{ entryId: string, content: string }>('summarize-entry', async ([job]) => {
    const { entryId, content } = job.data;
    logger.info(`Processing summary for entry ${entryId}`);

    try {
      const summaryResult = await processEntry(content);
      if (summaryResult instanceof Error) {
        logger.error(`Error processing summary for entry ${entryId}:`, summaryResult);
        return { success: false, entryId, error: summaryResult };
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
      logger.error(`Error processing summary for entry ${entryId}:`, error);
      return { success: false, entryId, error: error };
    }
  });
}

async function setupMinifluxSync(intervalMinutes: number) {
  // Schedule the recurring sync job
  logger.debug('Settting up miniflux sync queue');
  await boss.createQueue(SYNC_JOB_NAME);
  logger.debug('Setting up miniflux sync job');
  await boss.schedule(SYNC_JOB_NAME, `*/${intervalMinutes} * * * *`);

  // Set up the work handler for the sync job
  await boss.work(SYNC_JOB_NAME, async ([job]) => {
    logger.info(`Starting Miniflux sync job ${job.id}`);

    try {
      const { newFeeds, newEntries } = await fetchNewData(minifluxClient);

      logger.info(`Fetched ${newFeeds.length} new feeds and ${newEntries.length} new entries`);

      if (Array.isArray(newEntries)) {
        logger.info(`Queueing ${newEntries.length} entries for summarization`);
        for (const entry of newEntries) {
          const id = await boss.send({
            name: SUMMARIZE_ENTRY_JOB_NAME,
            data: {
              entryId: entry.id.toString(),
              content: entry.content
            }
          });
          logger.debug(`Queued entry for summarization: ${entry.id} with id ${id}`);
        }
      } else {
        logger.warn(`newEntries is not an array`, typeof newEntries);
      }

      await storeProcessedData(newFeeds, newEntries);

      logger.info(`Miniflux sync job ${job.id} completed successfully`);
      return { success: true, newFeedsCount: newFeeds.length, newEntriesCount: newEntries.length };
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

export async function processNewEntries(newEntries: any[]) {
  const batchSize = 100; // Adjust as needed for trend analysis
  for (let i = 0; i < newEntries.length; i += batchSize) {
    const batchEntries = newEntries.slice(i, i + batchSize);
    const startId = batchEntries[0].id;
    const endId = batchEntries[batchEntries.length - 1].id;
    await queueEntryBatchForTrendProcessing(startId, endId);
  }

  // Queue entries for summarization
  for (const entry of newEntries) {
    await boss.send('summarize-entry', { entryId: entry.id, content: entry.content });
  }
}


