import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../../db";
import { entries, hourlyBatches } from "../../db/schema";
import { trendAnalyzer } from "../../trend-analyzer";
import { getBossInstance } from "../client";
import logger from "@/packages/utils/src/logger";
import { ulid } from "ulid";
import { QueueNames } from "../initQueues";

export async function setupTrendAnalysisJobs() {
  const boss = await getBossInstance();
  // Hourly trend processing
  await boss.schedule(QueueNames.TREND_ANALYSIS_HOURLY, '0 * * * *');

  await boss.work(QueueNames.TREND_ANALYSIS_HOURLY, async () => {
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
  await boss.work<{ batchId: string, entryIds: string[] }>(QueueNames.ANALYZE_BATCH_TRENDS, async ([job]) => {
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
}

export async function queueBatchForAnalysis(batchHour: Date) {
  const boss = await getBossInstance();
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

    await boss.send(QueueNames.ANALYZE_BATCH_TRENDS,
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
