import { db } from '../../db';
import { honoFeeds, honoEntries, honoUsers } from '../../db/honoSchema';
import { minifluxApi } from './minifluxApi';

export async function syncWithMiniflux() {
  // Sync users
  const minifluxUsers = await minifluxApi.getUsers();
  for (const user of minifluxUsers) {
    await db.insert(honoUsers).values({
      id: user.id,
      minifluxUserId: user.id,
      lastSyncedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: honoUsers.minifluxUserId,
      set: { lastSyncedAt: new Date().toISOString() },
    });
  }

  // Sync feeds
  const minifluxFeeds = await minifluxApi.getFeeds();
  for (const feed of minifluxFeeds) {
    await db.insert(honoFeeds).values({
      id: feed.id,
      minifluxFeedId: feed.id,
      lastSyncedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: honoFeeds.minifluxFeedId,
      set: { lastSyncedAt: new Date().toISOString() },
    });
  }

  // Sync entries (limit to recent entries for performance)
  const recentEntries = await minifluxApi.getEntries('unread', 100);
  for (const entry of recentEntries.entries) {
    await db.insert(honoEntries).values({
      id: entry.id,
      minifluxEntryId: entry.id,
      lastSyncedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: honoEntries.minifluxEntryId,
      set: { lastSyncedAt: new Date().toISOString() },
    });
  }
}
