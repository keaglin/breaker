import logger from "@/packages/utils/src/logger";
import { getBossInstance } from "../client";
import { fetchNewData } from "../../services/miniflux/fetcher";
import { storeProcessedData } from "../../services/miniflux/storeData";
import { QueueNames } from "../initQueues";

export const MINIFLUX_SYNC_INTERVAL_MINUTES = 10;

export async function setupMinifluxSync(intervalMinutes: number) {
  const boss = await getBossInstance();
  // Schedule the recurring sync job
  logger.debug('Setting up miniflux sync queue');
  await boss.schedule(QueueNames.MINIFLUX_SYNC, `*/${intervalMinutes} * * * *`);

  // Set up the work handler for the sync job
  await boss.work(QueueNames.MINIFLUX_SYNC, async ([job]) => {
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
  await boss.send({ name: QueueNames.MINIFLUX_SYNC });
}
