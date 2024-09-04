import { extractTextFromHtml } from "@/packages/utils/src/extract-text-from-html";
import logger from "@/packages/utils/src/logger";
import { eq, desc, sql } from "drizzle-orm";
import { getBossInstance } from "../client";
import { db } from "../../db";
import { entries, summaryJobStats } from "../../db/schema";
import { processEntry } from "../../entry-processor";
import { QueueNames } from "../initQueues";
import { ulid } from "ulid";

const SUMMARY_INTERVAL_MINUTES = 2; // originally had this set at 5min, but we want to be able to summarize more than 288 per day
// API rate limit constants
const REQUESTS_PER_MINUTE = 15;
const REQUESTS_PER_DAY = 1_500;
const TOKENS_PER_MINUTE = 1_000_000;

// Adjust these values based on your average token usage per request
const ESTIMATED_TOKENS_PER_REQUEST = 1000;

// Min(15 requests per minute, 1000) = 15
const SUMMARIZE_RATE_LIMIT = Math.min(REQUESTS_PER_MINUTE, Math.floor(TOKENS_PER_MINUTE / ESTIMATED_TOKENS_PER_REQUEST));
const SUMMARIZE_RATE_LIMIT_INTERVAL = 60 * 1000; // 60 seconds in milliseconds


export async function setupEntrySummarizationJobs() {
  const boss = await getBossInstance();
  // Queue entries for summarization every 5 minutes
  logger.debug('Setting up entry summarization queue');
  await boss.schedule(QueueNames.SUMMARIZE_ENTRY,
    `*/${SUMMARY_INTERVAL_MINUTES} * * * *`, {},
    { singletonKey: 'summarize-entry', singletonHours: 12, retryDelay: 4000, retryLimit: 3, retryBackoff: true });

  // Summarize entries with rate limiting
  logger.debug('Setting up summarize entry job with rate limiting');

  await boss.work(QueueNames.SUMMARIZE_ENTRY, { batchSize: 1 }, async ([job]) => {
    logger.info(`Started processing summary job ${job.id}`);

    const [entry] = await db.select({ id: entries.id, content: entries.content, processedForSummary: entries.processedForSummary })
      .from(entries)
      .orderBy(desc(entries.publishedAt))
      .where(eq(entries.processedForSummary, false))
      .limit(1);

    if (!entry) {
      logger.info('No entries to process');
      return { success: true, noEntries: true };
    }

    const { id: entryId, processedForSummary } = entry;
    const content = extractTextFromHtml(entry.content!);

    if (!content) {
      logger.error(`Entry ${entryId} has no content. Skipping.`);
      return { success: false, entryId, error: 'No content' };
    }

    logger.info(`Processing summary for entry ${entryId}`);

    try {
      // Check if the entry has already been processed
      if (processedForSummary) {
        logger.info(`Entry ${entryId} has already been processed. Skipping.`);
        return { success: true, entryId, alreadyProcessed: true };
      }

      // Estimate token usage
      const estimatedTokens = Math.ceil(content.length / 3);

      const now = new Date();

      // First, try to update an existing record
      const updateResult = await db.update(summaryJobStats)
        .set({
          lastUpdated: now,
          dailyRequestCount: sql`CASE
            WHEN ${summaryJobStats.lastUpdated} < NOW() - INTERVAL '24 hours'
            THEN 1
            ELSE ${summaryJobStats.dailyRequestCount} + 1
          END`,
          tokenUsageLastMinute: 0,
          lastMinuteReset: now,
        })
        .where(eq(summaryJobStats.entryId, entryId))
        .returning({ updatedId: summaryJobStats.id });

      // If no record was updated, insert a new one
      if (updateResult.length === 0) {
        logger.info(`No existing summaryJobStats record found for entry ${entryId}. Inserting new record.`);
        await db.insert(summaryJobStats)
          .values({
            id: ulid(),
            entryId,
            dailyRequestCount: 1,
            tokenUsageLastMinute: 0,
            lastMinuteReset: now,
            lastUpdated: now,
          });
      }

      // Fetch the most recent stats
      const [stats] = await db.select()
        .from(summaryJobStats)
        .orderBy(desc(summaryJobStats.lastUpdated))
        .limit(1);

      // Check daily limit
      if (stats.dailyRequestCount > REQUESTS_PER_DAY) {
        logger.warn('Daily request limit reached. Skipping job.');
        return { success: false, entryId, error: 'Daily request limit reached' };
      }

      // Check and reset per-minute token usage
      if (now.getTime() - stats.lastMinuteReset.getTime() > SUMMARIZE_RATE_LIMIT_INTERVAL) {
        await db.update(summaryJobStats)
          .set({
            tokenUsageLastMinute: 0,
            lastMinuteReset: now,
          })
          .where(eq(summaryJobStats.entryId, entryId));
        stats.tokenUsageLastMinute = 0;
      }

      if (stats.tokenUsageLastMinute + estimatedTokens > TOKENS_PER_MINUTE) {
        logger.warn('Token per minute limit reached. Failing job to retry later.');
        return { success: false, entryId, error: 'Rate limit reached' };
      }

      // Update stats
      await db.update(summaryJobStats)
        .set({
          dailyRequestCount: stats.dailyRequestCount + 1,
          tokenUsageLastMinute: stats.tokenUsageLastMinute + estimatedTokens,
          lastUpdated: now,
        })
        .where(eq(summaryJobStats.entryId, entryId));

      const summaryResult = await processEntry(content);
      if (summaryResult instanceof Error) {
        logger.error(`Error processing summary for entry ${entryId}: `, summaryResult);
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
      logger.error(`Unexpected error processing summary for entry ${entryId}: `, error);
      return { success: false, entryId, error: 'Unexpected error occurred' };
    }
  });
}
