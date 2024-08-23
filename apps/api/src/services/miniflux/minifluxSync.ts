import { db } from '../../db';
import { honoFeeds, honoEntries, insertHonoFeedSchema, insertHonoEntrySchema } from '../../db/honoSchema';
import { minifluxApi } from './minifluxApi';
import logger from '../../../../../packages/utils/src/logger';
import { ulid } from 'ulid';
import { z } from 'zod';

// Define a schema for the incoming Miniflux feed data
export const minifluxFeedSchema = z.object({
  id: z.number(),
  title: z.string(),
  feed_url: z.string(),
  // site_url: z.string(),
  // Add other fields as needed
});

export const minifluxEntrySchema = z.object({
  id: z.number(),
  feed_id: z.number(),
  title: z.string(),
  url: z.string(),
  content: z.string(),
  // Add other fields as needed
});

export async function syncWithMiniflux() {
  logger.info('Starting Miniflux synchronization');

  // Sync feeds
  logger.info('Syncing feeds');
  const minifluxFeeds = await minifluxApi.getFeeds();
  logger.info(`Retrieved ${minifluxFeeds.length} feeds from Miniflux`);

  for (const feed of minifluxFeeds) {
    // console.log('miniflux feed', feed);
    try {
      const validatedFeed = minifluxFeedSchema.parse(feed);
      logger.debug('Validated feed:', validatedFeed);

      await db.insert(honoFeeds)
        .values({
          id: ulid(),
          minifluxFeedId: validatedFeed.id,
          title: validatedFeed.title,
          feedUrl: validatedFeed.feed_url,
          lastSyncedAt: new Date().toISOString(),
          // Add other fields you want to store
        })
        .onConflictDoUpdate({
          target: honoFeeds.id,
          set: {
            lastSyncedAt: new Date().toISOString(),
            // Update other fields if needed
          },
        });
    } catch (error) {
      logger.error('Error processing feed:', feed);
      logger.error('Validation error:', error);
      continue;
    }
  }
  logger.info('Finished syncing feeds');

  // Sync entries
  logger.info('Syncing recent entries');
  const recentEntries = await minifluxApi.getEntries('unread', 100);
  logger.info(`Retrieved ${recentEntries.entries.length} recent entries from Miniflux`);

  for (const entry of recentEntries.entries) {
    const validatedEntry = minifluxEntrySchema.parse(entry);
    await db.insert(honoEntries)
      .values({
        id: ulid(),
        minifluxEntryId: validatedEntry.id,
        feedId: validatedEntry.feed_id,
        title: validatedEntry.title,
        url: validatedEntry.url,
        content: validatedEntry.content,
        lastSyncedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: honoEntries.id,
        set: {
          lastSyncedAt: new Date().toISOString(),
          // Update other fields if needed
        },
      });
  }
  logger.info('Finished syncing recent entries');

  logger.info('Miniflux synchronization completed');
}
