import logger from '@/packages/utils/src/logger';
import { db } from '../../db';
import { feeds, entries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';

export async function storeProcessedData(processedFeeds: any[], processedEntries: any[]) {
  const now = new Date();

  await db.transaction(async (tx) => {
    // Store feeds and keep a mapping of Miniflux feed IDs to our database feed IDs
    const feedIdMap = new Map<number, string>();

    for (const feed of processedFeeds) {
      const result = await tx.insert(feeds).values({
        id: ulid(),
        minifluxId: feed.id,
        title: feed.title,
        feedUrl: feed.feed_url,
        siteUrl: feed.site_url,
        lastSyncedAt: now,
        createdAt: now,
      }).onConflictDoUpdate({
        target: feeds.minifluxId,
        set: {
          title: feed.title,
          feedUrl: feed.feed_url,
          siteUrl: feed.site_url,
          lastSyncedAt: now,
          updatedAt: now,
        },
      }).returning({ id: feeds.id, minifluxId: feeds.minifluxId });

      feedIdMap.set(result[0].minifluxId, result[0].id);
    }

    // Store entries, using the feedIdMap to set the correct feedId
    for (const entry of processedEntries) {
      const feedId = feedIdMap.get(entry.feed_id);
      if (!feedId) {
        logger.error(`No matching feed found for entry ${entry.id} with feed_id ${entry.feed_id}`);
        continue;
      }

      await tx.insert(entries).values({
        id: ulid(),
        minifluxId: entry.id,
        feedId: feedId,  // Use our database's feed ID, not Miniflux's
        title: entry.title,
        url: entry.url,
        content: entry.content,
        author: entry.author,
        publishedAt: new Date(entry.published_at),
        lastSyncedAt: now,
        status: entry.status,
        summary: entry.summary,
        keypoints: entry.keypoints,
        createdAt: now,
      }).onConflictDoUpdate({
        target: entries.minifluxId,
        set: {
          feedId: feedId,  // Update this as well in case the entry moved to a different feed
          title: entry.title,
          url: entry.url,
          content: entry.content,
          author: entry.author,
          publishedAt: new Date(entry.published_at),
          lastSyncedAt: now,
          status: entry.status,
          summary: entry.summary,
          keypoints: entry.keypoints,
          updatedAt: now,
        },
      });
    }
  });
}
