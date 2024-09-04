import logger from "@/packages/utils/src/logger";
import { sql, and, gte, lt, desc, eq, min, max } from "drizzle-orm";
import { ulid } from "ulid";
import { getBossInstance } from "../client";
import { db } from "../../db";
import { entries, hourlyBatches } from "../../db/schema";
import { trendAnalyzer } from "../../trend-analyzer";
import { QueueNames } from "../initQueues";
import { queueBatchForAnalysis } from "./trend-analysis";

export async function setupBackfillTrendAnalysisJobs() {
  const boss = await getBossInstance();
  logger.debug('Setting up backfill jobs');

  // Job to identify and create batches
  await boss.work<{ startDate: string, endDate: string }>(QueueNames.IDENTIFY_BACKFILL_BATCHES, async ([job]) => {
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
          const jobId = await boss.send(QueueNames.ANALYZE_BATCH_TRENDS, { batchId, entryIds }, { singletonKey: `analyze-batch-trends-${batchId}`, singletonHours: 12 });
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
  await boss.work<{ batchId: string, entryIds: string[] }>(QueueNames.ANALYZE_BATCH_TRENDS,
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

export async function initializeBackfill() {
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
