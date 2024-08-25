import { MinifluxClient } from './client';
import { db } from '../../db';
import { feeds, entries } from '../../db/schema';

export async function fetchNewData(minifluxClient: MinifluxClient) {
  // Fetch new feeds
  const lastFetchedFeed = await db.select({ minifluxId: feeds.minifluxId })
    .from(feeds)
    .orderBy(feeds.minifluxId)
    .limit(1);

  const lastFeedId = lastFetchedFeed[0]?.minifluxId || 0;
  const newFeeds = await minifluxClient.getFeeds(lastFeedId);

  // Fetch new entries
  const lastFetchedEntry = await db.select({ minifluxId: entries.minifluxId })
    .from(entries)
    .orderBy(entries.minifluxId)
    .limit(1);

  const lastEntryId = lastFetchedEntry[0]?.minifluxId || 0;
  console.debug(`lastEntryId`, lastEntryId);
  const newEntries = await minifluxClient.getEntries({ after_entry_id: lastEntryId });

  return { newFeeds, newEntries };
}
