import { extractTextFromHtml } from "@/packages/utils/src/extract-text-from-html";
import logger from "@/packages/utils/src/logger";
import { eq, desc } from "drizzle-orm";
import { getBossInstance } from "../client";
import { db } from "../../db";
import { entries } from "../../db/schema";
import { processEntry } from "../../entry-processor";
import { QueueNames } from "../initQueues";

const SUMMARY_BATCH_SIZE = 10;
const SUMMARY_INTERVAL_MINUTES = 5;
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

export async function setupEntrySummarizationJobs() {
  const boss = await getBossInstance();
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

    if (!boss) {
      logger.error('PgBoss is not initialized');
      return { success: false, error: 'PgBoss is not initialized' };
    }

    for (const entry of unprocessedEntries) {
      // logger.debug(`Queueing entry for summarization: ${entry.id}`);
      // logger.debug(`Content: ${extractTextFromHtml(entry.content!)}`);

      try {
        const id = await boss.send(QueueNames.SUMMARIZE_ENTRY, { entryId: entry.id, content: extractTextFromHtml(entry.content!) }, {
          singletonKey: `summarize-entry-${entry.id}`,
          singletonHours: 12,
          retryLimit: 3,
          retryDelay: SUMMARIZE_RATE_LIMIT_INTERVAL / SUMMARIZE_RATE_LIMIT,
          retryBackoff: true
        });
        if (!id) {
          logger.error(`Failed to queue summarize-entry job for entry ${entry.id}`);
        } else {
          logger.info(`Queued summarize-entry job ${id} for entry ${entry.id}`);
        }
      } catch (error) {
        logger.error(`Error queuing entry for summarization: ${entry.id}`, error);
      }
    }

    logger.info(`Queued ${unprocessedEntries.length} entries for summarization`);
    return { success: true, queuedCount: unprocessedEntries.length, entryIds: unprocessedEntries.map(e => e.id) };
  });

  await boss.work<{ entryId: string, content: string }>(QueueNames.SUMMARIZE_ENTRY, { batchSize: SUMMARIZE_RATE_LIMIT }, async ([job]) => {
    logger.info(`Started processing summary job ${job.id} for entry ${job.data.entryId}`);
    const { entryId, content } = job.data;

    try {
      const existingEntry = await db.select({ processedForSummary: entries.processedForSummary })
        .from(entries)
        .where(eq(entries.id, entryId))
        .limit(1);

      // Check if the entry has already been processed
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
