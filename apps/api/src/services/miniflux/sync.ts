import { MinifluxClient } from './client';
import { fetchNewData } from './fetcher';
import { processEntry } from '../entry-processor';
import { storeProcessedData } from './storeData';
import logger from '@/packages/utils/src/logger';
import invariant from 'tiny-invariant';

invariant(process.env.MINIFLUX_API_KEY, 'MINIFLUX_API_KEY is not set');
invariant(process.env.MINIFLUX_API_URL, 'MINIFLUX_API_URL is not set');

export async function syncMinifluxData() {
  logger.debug('syncMinifluxData');
  logger.debug('MINIFLUX_API_URL', process.env.MINIFLUX_API_URL);
  logger.debug('MINIFLUX_API_KEY', process.env.MINIFLUX_API_KEY);
  const minifluxClient = new MinifluxClient(
    process.env.MINIFLUX_API_URL as string,
    process.env.MINIFLUX_API_KEY as string
  );

  try {
    logger.info('Starting Miniflux sync');

    const { newFeeds, newEntries } = await fetchNewData(minifluxClient);

    logger.info(`Fetched ${newFeeds.length} new feeds and ${newEntries.length} new entries`);

    console.debug(`newEntries`, newEntries.length);
    if (Array.isArray(newEntries)) {
      console.debug(`newEntries`, newEntries[0]);
      // const processedEntries = await Promise.all(newEntries.map(entry => {
      //   console.debug(`Processing entry`, entry.title);
      //   return processEntry(entry);
      // }));
      await storeProcessedData(newFeeds, newEntries);
    } else {
      console.debug(`newEntries is not an array`, typeof newEntries);
    }


    logger.info('Miniflux sync completed successfully');
  } catch (error) {
    logger.error('Error during Miniflux sync', { error });
    throw error;
  }
}

// Run the sync service periodically
export function startSyncService(intervalMinutes: number) {
  setTimeout(syncMinifluxData, 0)
  setInterval(syncMinifluxData, intervalMinutes * 60 * 1000);
  logger.info(`Sync service started, running every ${intervalMinutes} minutes`);
}
