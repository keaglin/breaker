import { MinifluxClient } from './client';
import { fetchNewData } from './fetcher';
import { storeProcessedData } from './storeData';
import logger from '@/packages/utils/src/logger';
import invariant from 'tiny-invariant';
import PgBoss from 'pg-boss';

invariant(process.env.MINIFLUX_API_KEY, 'MINIFLUX_API_KEY is not set');
invariant(process.env.MINIFLUX_API_URL, 'MINIFLUX_API_URL is not set');

const SYNC_JOB_NAME = 'miniflux-sync';
const SUMMARIZE_ENTRY_JOB_NAME = 'summarize-entry'; // This should match the name in your existing setup

export async function setupMinifluxSync(boss: PgBoss, intervalMinutes: number) {
  // Schedule the recurring sync job
  await boss.schedule(SYNC_JOB_NAME, `*/${intervalMinutes} * * * *`);

  // Set up the work handler for the sync job
  await boss.work(SYNC_JOB_NAME, async (job) => {
    logger.info(`Starting Miniflux sync job ${job.id}`);

    const minifluxClient = new MinifluxClient(
      process.env.MINIFLUX_API_URL as string,
      process.env.MINIFLUX_API_KEY as string
    );

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

// This function can be called in your main application setup
export async function initializeMinifluxSync(boss: PgBoss, intervalMinutes: number) {
  await setupMinifluxSync(boss, intervalMinutes);
}
