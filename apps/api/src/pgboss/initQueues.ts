import { getBossInstance } from "./client";
import logger from "@/packages/utils/src/logger";

export const QueueNames = {
  TREND_ANALYSIS_HOURLY: 'queue-trend-analysis-hourly',
  QUEUE_ENTRIES_FOR_SUMMARIES: 'queue-entries-for-summaries',
  SUMMARIZE_ENTRY: 'summarize-entry',
  MINIFLUX_SYNC: 'miniflux-sync',
  IDENTIFY_BACKFILL_BATCHES: 'identify-backfill-batches',
  ANALYZE_BATCH_TRENDS: 'analyze-batch-trends'
} as const;

type QueueName = typeof QueueNames[keyof typeof QueueNames];

export async function initializeQueues() {
  const boss = await getBossInstance();
  const requiredQueues: QueueName[] = Object.values(QueueNames);

  const existingQueues = await boss.getQueues();
  const queuesToCreate = requiredQueues.filter(queue => !existingQueues.map(q => q.name).includes(queue));

  for (const queue of queuesToCreate) {
    try {
      await boss.createQueue(queue);
      logger.info(`Created queue: ${queue}`);
    } catch (error) {
      logger.warn(`Failed to create queue ${queue}, it may already exist`, error);
    }
  }
}
