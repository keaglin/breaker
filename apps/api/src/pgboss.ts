import PgBoss from 'pg-boss';
import logger from '@/packages/utils/src/logger';
import { trendAnalyzer } from './trend-analyzer';
import { processEntry } from './entry-processor';
import { db } from './db';
import { entries, hourlyBatches } from './db/schema';
import { eq, and, gte, lt, desc, sql, min, max, inArray, asc } from 'drizzle-orm';
import { ulid } from 'ulid';
import { fetchNewData } from './services/miniflux/fetcher';
import { storeProcessedData, type StoredEntry } from './services/miniflux/storeData';
import invariant from 'tiny-invariant';
import { extractTextFromHtml } from '@/packages/utils/src/extract-text-from-html';


invariant(process.env.MINIFLUX_API_KEY, 'MINIFLUX_API_KEY is not set');
invariant(process.env.MINIFLUX_API_URL, 'MINIFLUX_API_URL is not set');

const SYNC_JOB_NAME = 'miniflux-sync';
const SUMMARIZE_ENTRY_JOB_NAME = 'summarize-entry';
const ANALYZE_BATCH_JOB = 'analyze-batch-trends';
let boss: PgBoss;

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
    boss.on('wip', ([job]) => {
      const jobInfo = {
        id: job.id,
        name: job.name,
        options: job.options,
        state: job.state,
        count: job.count,
        createdOn: job.createdOn,
        lastFetchedOn: job.lastFetchedOn,
        lastJobStartedOn: job.lastJobStartedOn,
        lastJobEndedOn: job.lastJobEndedOn,
        lastJobDuration: job.lastJobDuration,
        lastError: job.lastError,
        lastErrorOn: job.lastErrorOn
      };
      console.debug(`Job in progress for worker ${job.name} (${job.id}):`, JSON.stringify(jobInfo, null, 2));
    });
    boss.on('monitor-states', (monitorStates) => {
      logger.info('PgBoss monitor states:', JSON.stringify(monitorStates, null, 2));
    });
    boss.on('stopped', () => logger.info('PgBoss stopped'));

    await boss.start();
    logger.info('PgBoss initialized and started');

    await initializeQueues();
    logger.info('All job handlers set up');
    logger.info('Backfill initialized');

  } catch (error) {
    logger.error('Error initializing PgBoss:', error);
    throw error;
  }
}

async function initializeQueues() {
  const requiredQueues = [
    'queue-trend-analysis-hourly',
    'queue-trend-analysis-daily',
    'queue-trend-analysis-weekly',
    'queue-entries-for-summaries',
    'summarize-entry',
    SYNC_JOB_NAME,
    'identify-backfill-batches',
    ANALYZE_BATCH_JOB
  ];

  const existingQueues = await boss.getQueues();
  // console.debug('Existing queues:', existingQueues);
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
  await setupMinifluxSync(MINIFLUX_SYNC_INTERVAL_MINUTES)
  await setupBackfillJobs();
  await initializeBackfill();
}

async function setupTrendAnalysisJobs() {
  // Hourly trend processing
  await boss.schedule('queue-trend-analysis-hourly', '0 * * * *');

  await boss.work('queue-trend-analysis-hourly', async () => {
    const [latestBatch] = await db.select()
      .from(hourlyBatches)
      .orderBy(desc(hourlyBatches.batchHour))
      .limit(1);

    if (latestBatch) {
      const batchHour = new Date(latestBatch.batchHour);
      const nextBatchHour = new Date(batchHour.getTime() + 60 * 60 * 1000);

      await queueBatchForAnalysis(nextBatchHour);
    }
  });

  // Set up the work handler for batch analysis
  await boss.work<{ batchId: string, entryIds: string[] }>(ANALYZE_BATCH_JOB, async ([job]) => {
    const { batchId, entryIds } = job.data;
    await trendAnalyzer.processBatch(batchId, entryIds);

    // Update batch as processed
    await db.update(hourlyBatches)
      .set({
        isProcessed: true,
        processedAt: new Date()
      })
      .where(eq(hourlyBatches.id, batchId));

    return { success: true, batchId, entriesProcessed: entryIds.length };
  });

  // Deprecating in favor of querying trends from the hourly batches
  // See getWeeklyTrends() and getDailyTrends() in trend-analyzer.ts
  // // Daily trend analysis
  // await boss.schedule('queue-trend-analysis-daily', '0 0 * * *');

  // await boss.work('queue-trend-analysis-daily', async () => {
  //   const now = new Date();
  //   const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  //   for (let hour = 0; hour < 24; hour++) {
  //     const batchHour = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hour);
  //     await queueBatchForAnalysis(batchHour);
  //   }
  // });

  // // Weekly trend analysis
  // await boss.schedule('queue-trend-analysis-weekly', '0 0 * * 0');

  // await boss.work('queue-trend-analysis-weekly', async () => {
  //   const now = new Date();
  //   const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  //   for (let d = new Date(oneWeekAgo); d < now; d.setDate(d.getDate() + 1)) {
  //     for (let hour = 0; hour < 24; hour++) {
  //       const batchHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour);
  //       await queueBatchForAnalysis(batchHour);
  //     }
  //   }
  // });
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
      .orderBy(desc(entries.publishedAt))
      .limit(SUMMARY_BATCH_SIZE);

    for (const entry of unprocessedEntries) {
      await boss.send('summarize-entry', { entryId: entry.id, content: entry.content }, {
        singletonKey: `summarize-entry-${entry.id}`,
        singletonHours: 12,
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
      const estimatedTokens = extractTextFromHtml(content).split(/\s+/).length * 1.3;

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

      logger.info(`Sync completed. Fetched data for ${allFeeds.length} feeds.`);
      logger.info(`Found ${newEntries.length} new entries.`);

      // Store new entries in the database
      const { entries } = await storeProcessedData(allFeeds, newEntries);

      logger.info(`Stored ${entries.length} new entries in the database.`);

      return { success: true, newEntriesCount: entries.length };
    } catch (error) {
      logger.error(`Error during Miniflux sync job ${job.id}`, { error });
      throw error; // This will mark the job as failed in pg-boss
    }
  });

  logger.info(`Miniflux sync job scheduled to run every ${intervalMinutes} minutes`);

  // Optionally, run an initial sync immediately
  await boss.send({ name: SYNC_JOB_NAME });
}

async function setupBackfillJobs() {
  logger.debug('Setting up backfill jobs');

  // Job to identify and create batches
  await boss.work<{ startDate: string, endDate: string }>('identify-backfill-batches', async ([job]) => {
    const { startDate, endDate } = job.data;
    logger.info(`Identifying backfill batches from ${startDate} to ${endDate}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Group entries by hour directly in the database query
    const entriesByHour = await db
      .select({
        hourKey: sql<string>`date_trunc('hour', ${entries.publishedAt})::text`,
        entryIds: sql<string[]>`array_agg(${entries.id})`
      })
      .from(entries)
      .where(
        and(
          gte(entries.publishedAt, start),
          lt(entries.publishedAt, end)
        )
      )
      .groupBy(sql`date_trunc('hour', ${entries.publishedAt})`)
      .orderBy(desc(entries.publishedAt));

    console.debug(`Entries by hour: ${JSON.stringify(entriesByHour[0], null, 2)}`);

    // Create batches and queue processing jobs
    for (const { hourKey, entryIds } of entriesByHour) {
      console.debug(`Processing hour ${hourKey} with ${entryIds.length} entries`);
      // Convert hourKey to Date object
      const batchHour = new Date(hourKey);

      console.debug(`hourlyBatches.batchHour type: ${typeof hourlyBatches.batchHour}`);
      console.debug(`hourKey type: ${typeof hourKey}`);
      // If there are entries in the hour, we need to process the batch
      if (entryIds.length > 0) {
        // Check if batch already exists
        const existingBatch = await db.select()
          .from(hourlyBatches)
          .where(eq(hourlyBatches.batchHour, batchHour))
          .limit(1);

        console.debug(`Existing batch: ${JSON.stringify(existingBatch, null, 2)}`);

        if (existingBatch.length === 0) {
          // Create new batch
          const batchId = ulid();
          await db.insert(hourlyBatches).values({
            id: batchId,
            batchHour: batchHour,
            entryCount: entryIds.length,
            isProcessed: false,
          });

          // Queue a job to process this batch
          const jobId = await boss.send('analyze-batch-trends', { batchId, entryIds }, { singletonKey: `analyze-batch-trends-${batchId}`, singletonHours: 12 });
          logger.info(`Queued processing job for batch ${batchId} with ${entryIds.length} entries, job id ${jobId}`);
        } else {
          logger.info(`Batch for ${batchHour.toISOString()} already exists, skipping`);
        }
      } // end if entryIds.length > 0
    } // end for

    logger.info(`Completed identifying backfill batches from ${startDate} to ${endDate}`);
    return { success: true };
  });

  // Job to process each batch
  await boss.work<{ batchId: string, entryIds: string[] }>('analyze-batch-trends',
    {
      batchSize: 1
    },
    async ([job]) => {
      const { batchId, entryIds } = job.data;
      logger.info(`Processing backfill batch ${batchId} with ${entryIds.length} entries`);

      try {
        const result = await trendAnalyzer.processBatch(batchId, entryIds);

        // Update batch as processed
        await db.update(hourlyBatches)
          .set({
            isProcessed: true,
            processedAt: new Date()
          })
          .where(eq(hourlyBatches.id, batchId));

        logger.info(`Completed processing backfill batch ${batchId}`);
        return result;
      } catch (error) {
        logger.error(`Error processing backfill batch ${batchId}:`, error);
        throw error; // This will mark the job as failed in pg-boss
      }
    }
  );
}

async function initializeBackfill() {
  try {
    const [result] = await db
      .select({
        earliestDate: min(entries.publishedAt),
        latestDate: max(entries.publishedAt),
      })
      .from(entries);

    if (result.earliestDate && result.latestDate) {
      const startDate = new Date(result.earliestDate);
      const endDate = new Date(result.latestDate);

      logger.info(`Initializing backfill from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      for (let batchHour = startDate; batchHour < endDate; batchHour = new Date(batchHour.getTime() + 60 * 60 * 1000)) {
        await queueBatchForAnalysis(batchHour);
      }
    } else {
      logger.info('No entries found for backfill');
    }
  } catch (error) {
    logger.error('Error initializing backfill:', error);
  }
}

async function queueBatchForAnalysis(batchHour: Date) {
  const batchStart = batchHour;
  const batchEnd = new Date(batchStart.getTime() + 60 * 60 * 1000);

  const batchEntries = await db.select({ id: entries.id })
    .from(entries)
    .where(
      and(
        gte(entries.publishedAt, batchStart),
        lt(entries.publishedAt, batchEnd)
      )
    );

  if (batchEntries.length > 0) {
    const batchId = ulid();
    await db.insert(hourlyBatches).values({
      id: batchId,
      batchHour: batchStart,
      entryCount: batchEntries.length,
      isProcessed: false,
    });

    await boss.send(ANALYZE_BATCH_JOB,
      { batchId, entryIds: batchEntries.map(entry => entry.id) },
      {
        singletonKey: `analyze-batch-trends-${batchId}`,
        singletonHours: 12,
        singletonNextSlot: true,
        retryLimit: 3,
        retryBackoff: true
      }
    );
    logger.info(`Queued backfill batch ${batchId} with ${batchEntries.length} entries`);
  }
}

/**
 * Trigger backfill trend analysis for past hours
 *
 * This function initiates a backfill job to analyze trends for entries
 * created between the specified start and end dates. It's useful for
 * processing historical data or catching up on trend analysis for a
 * specific time range.
 *
 * @example
 * const startDate = new Date('2023-05-01T00:00:00Z');
 * const endDate = new Date();
 * await triggerBackfill(startDate, endDate);
 */
// export async function triggerBackfill(startDate: Date, endDate: Date) {
//   const jobId = await boss.send('identify-backfill-batches', { startDate, endDate });
//   logger.info(`Queued backfill job ${jobId} from ${startDate} to ${endDate}`);
//   return jobId;
// }

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


