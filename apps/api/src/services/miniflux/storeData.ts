import logger from '@/packages/utils/src/logger';
import { db } from '../../db';
import { feeds, entries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';

interface StoredFeed {
  id: string;
  minifluxId: number;
}

export interface StoredEntry {
  id: string;
  minifluxId: number;
  content: string | null;
}

export async function storeProcessedData(processedFeeds: any[], processedEntries: any[]): Promise<{
  feeds: StoredFeed[];
  entries: StoredEntry[];
}> {
  const now = new Date();
  const storedFeeds: StoredFeed[] = [];
  const storedEntries: StoredEntry[] = [];
  const feedIdMap = new Map<number, string>();

  await db.transaction(async (tx) => {
    // Store or update all feeds
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

      const storedFeed = { id: result[0].id, minifluxId: result[0].minifluxId };
      storedFeeds.push(storedFeed);
      feedIdMap.set(storedFeed.minifluxId, storedFeed.id);
    }

    // Store new entries
    for (const entry of processedEntries) {
      const feedId = feedIdMap.get(entry.feed_id);
      if (!feedId) {
        logger.error(`No matching feed found for entry ${entry.id} with feed_id ${entry.feed_id}`);
        continue;
      }

      const result = await tx.insert(entries).values({
        id: ulid(),
        minifluxId: entry.id,
        feedId: feedId,
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
          feedId: feedId,
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
      }).returning({ id: entries.id, minifluxId: entries.minifluxId, content: entries.content });

      storedEntries.push({
        id: result[0].id,
        minifluxId: result[0].minifluxId,
        content: result[0].content
      });
    }
  });

  return { feeds: storedFeeds, entries: storedEntries };
}
