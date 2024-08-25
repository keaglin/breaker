import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

// Sync metadata table
export const syncMetadata = pgTable('sync_metadata', {
  id: text('id').primaryKey(),
  entity: text('entity').notNull(),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastSyncedId: integer('last_synced_id'),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
});

export const feeds = pgTable('feeds', {
  id: text('id').primaryKey(),
  minifluxId: integer('miniflux_id').notNull().unique(),
  title: text('title').notNull(),
  feedUrl: text('feed_url').notNull(),
  siteUrl: text('site_url'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const entries = pgTable('entries', {
  id: text('id').primaryKey(),
  minifluxId: integer('miniflux_id').notNull().unique(),
  feedId: text('feed_id').references(() => feeds.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  content: text('content'),
  author: text('author'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).defaultNow(),
  status: text('status'),
  summary: text('summary'),
  keypoints: text('keypoints').array(),
  takeaways: text('takeaways').array(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
