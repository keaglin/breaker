import { db } from '../../db';
import { honoFeeds, honoEntries } from '../../db/honoSchema';
import { minifluxApi } from './minifluxApi';
import logger from '../../../../../packages/utils/src/logger';
import { ulid } from 'ulid';
import { minifluxFeedSchema, minifluxEntrySchema } from './minifluxSync';

const BATCH_SIZE = 100;
const STATUSES = ['unread', 'read', 'removed'];

export async function syncAllEntries() {
  logger.info('Starting full Miniflux entry synchronization');

  const feeds = await minifluxApi.getFeeds();
  logger.info(`Found ${feeds.length} feeds to sync`);

  for (const feed of feeds) {
    try {
      const validatedFeed = minifluxFeedSchema.parse(feed);
      logger.info(`Syncing entries for feed ${validatedFeed.title} (ID: ${validatedFeed.id})`);

      let totalEntriesSynced = 0;

      for (const status of STATUSES) {
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const entriesResponse = await minifluxApi.getEntries({
            feed_id: validatedFeed.id,
            limit: BATCH_SIZE,
            offset,
            status: status,
          });

          const entries = entriesResponse.entries;

          if (entries.length === 0) {
            hasMore = false;
            continue;
          }

          for (const entry of entries) {
            try {
              const validatedEntry = minifluxEntrySchema.parse(entry);
              await db.insert(honoEntries)
                .values({
                  id: ulid(),
                  minifluxEntryId: validatedEntry.id,
                  feedId: validatedFeed.id,
                  title: validatedEntry.title,
                  url: validatedEntry.url,
                  content: validatedEntry.content,
                  lastSyncedAt: new Date().toISOString(),
                })
                .onConflictDoUpdate({
                  target: honoEntries.id,
                  set: {
                    title: validatedEntry.title,
                    url: validatedEntry.url,
                    content: validatedEntry.content,
                    lastSyncedAt: new Date().toISOString(),
                  },
                });
            } catch (error) {
              logger.error(`Error processing entry ${entry.id} for feed ${validatedFeed.title}:`, error);
            }
          }

          totalEntriesSynced += entries.length;
          offset += entries.length;
        }

        logger.info(`Synced ${totalEntriesSynced} ${status} entries for feed ${validatedFeed.title}`);
      }

      logger.info(`Finished syncing all entries for feed ${validatedFeed.title}. Total entries: ${totalEntriesSynced}`);
    } catch (error) {
      logger.error(`Error processing feed ${feed.id}:`, error);
    }
  }

  logger.info('All entries synced successfully');
}

// Function to run the sync
export async function runFullSync() {
  try {
    await syncAllEntries();
    logger.info('Full Miniflux synchronization completed successfully');
  } catch (error) {
    logger.error('Error during full Miniflux synchronization:', error);
  }
}

// Uncomment the following line to run the sync when this file is executed
runFullSync();
