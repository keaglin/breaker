import { pgTable, text, timestamp, integer, boolean, real, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

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
  processedForTrends: boolean('processed_for_trends').notNull().default(false),
  processedForSummary: boolean('processed_for_summary').notNull().default(false),
});

export const trends = pgTable('trends', {
  time: timestamp('time', { withTimezone: true }).notNull(),
  keyword: text('keyword').notNull(),
  trendType: text('trend_type').notNull(),
  frequency: integer('frequency').notNull(),
  burstScore: real('burst_score'),
  data: text('data'),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.time, table.keyword] }),
  };
});

export const hourlyBatches = pgTable('hourly_batches', {
  id: text('id').primaryKey(),
  batchHour: timestamp('batch_hour').notNull().unique(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  entryCount: integer('entry_count').notNull(),
  isProcessed: boolean('is_processed').notNull().default(false),
});

export const summaryJobStats = pgTable('summary_job_stats', {
  id: text('id').primaryKey(),
  dailyRequestCount: integer('daily_request_count').notNull().default(0),
  tokenUsageLastMinute: integer('token_usage_last_minute').notNull().default(0),
  lastMinuteReset: timestamp('last_minute_reset').notNull().defaultNow(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
  entryId: text('entry_id').references(() => entries.id).notNull(),
});
