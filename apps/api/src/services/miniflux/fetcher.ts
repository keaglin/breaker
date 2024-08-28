import { MinifluxClient } from './client';
import { db } from '../../db';
import { feeds, entries } from '../../db/schema';
import { desc } from 'drizzle-orm';
import logger from '@/packages/utils/src/logger';
import { minifluxClient } from './client';

export async function fetchNewData() {
  // Fetch all feeds from Miniflux
  const allMinifluxFeeds = await minifluxClient.getFeeds();

  // Fetch new entries
  const lastFetchedEntry = await db.select({ minifluxId: entries.minifluxId })
    .from(entries)
    .orderBy(desc(entries.minifluxId))
    .limit(1);

  const lastEntryId = lastFetchedEntry[0]?.minifluxId || 0;
  logger.debug(`Last fetched entry ID: ${lastEntryId}`);
  const newEntries = await minifluxClient.getEntries({ after_entry_id: lastEntryId });

  // Filter out entries with non-existent feeds
  const validEntries = newEntries.filter(entry => {
    const feedExists = allMinifluxFeeds.some(feed => feed.id === entry.feed_id);
    if (!feedExists) {
      logger.warn(`Skipping entry ${entry.id} because feed ${entry.feed_id} does not exist in Miniflux`);
    }
    return feedExists;
  });

  return { allFeeds: allMinifluxFeeds, newEntries: validEntries };
}
