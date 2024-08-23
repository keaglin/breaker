import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Miniflux-like tables
// export const users = pgTable("users", {
//   id: text("id").primaryKey().notNull(),
//   username: text("username").notNull(),
//   password: text("password").notNull(),
//   // Add other necessary fields
// });

// export const feeds = pgTable("feeds", {
//   id: integer("id").primaryKey().notNull(),
//   // user_id: text("user_id").notNull().references(() => users.id),
//   title: text("title").notNull(),
//   feed_url: text("feed_url").notNull(),
//   // Add other necessary fields
// });

// export const entries = pgTable("entries", {
//   id: integer("id").primaryKey().notNull(),
//   // user_id: text("user_id").notNull().references(() => users.id),
//   feed_id: integer("feed_id").notNull().references(() => feeds.id),
//   title: text("title").notNull(),
//   url: text("url").notNull(),
//   content: text("content"),
//   // Add other necessary fields
// });

// This table extends Miniflux's users table
export const honoUsers = pgTable("hono_users", {
  id: text("id").primaryKey().notNull(),
  // minifluxUserId: text("miniflux_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  // Add any additional user-related fields here
});

// This table extends Miniflux's feeds table
export const honoFeeds = pgTable("hono_feeds", {
  id: text("id").primaryKey().notNull(),
  minifluxFeedId: integer("miniflux_feed_id").notNull().unique(),
  title: text("title").notNull(),
  feedUrl: text("feed_url").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  // Add any additional feed-related fields here
});

// This table extends Miniflux's entries table
export const honoEntries = pgTable("hono_entries", {
  id: text("id").primaryKey().notNull(),
  minifluxEntryId: integer("miniflux_entry_id").notNull().unique(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  feedId: integer("feed_id").notNull().references(() => honoFeeds.minifluxFeedId),
  title: text("title").notNull(),
  url: text("url").notNull(),
  content: text("content"),
  // Add any additional entry-related fields here, for example:
  userNotes: text("user_notes"),
  customTags: text("custom_tags").array(),
});

// Add any additional tables specific to your Hono app's functionality
// export const customFeature = pgTable("custom_feature", {
//   id: serial("id").primaryKey().notNull(),
//   honoUserId: integer("hono_user_id").notNull().references(() => honoUsers.id, { onDelete: "cascade" }),
//   name: text("name").notNull(),
//   config: jsonb("config"),
//   createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
//   updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
// });

// Infer Zod schemas from Drizzle tables
// export const insertHonoUserSchema = createInsertSchema(honoUsers);
// export const selectHonoUserSchema = createSelectSchema(honoUsers);

export const insertHonoFeedSchema = createInsertSchema(honoFeeds);
export const selectHonoFeedSchema = createSelectSchema(honoFeeds);

export const insertHonoEntrySchema = createInsertSchema(honoEntries);
export const selectHonoEntrySchema = createSelectSchema(honoEntries);

// You can also create custom schemas based on the inferred ones
export const customHonoEntrySchema = selectHonoEntrySchema.extend({
  customTags: z.array(z.string()).optional(),
});

// RPC procedure definitions using the inferred schemas
export const procedures = {
  // users: {
  //   getUser: z.function()
  //     .args(z.number())
  //     .returns(selectHonoUserSchema.nullable()),
  // },
  feeds: {
    getFeeds: z.function()
      .args(z.number())  // userId
      .returns(z.array(selectHonoFeedSchema)),
  },
  entries: {
    getEntries: z.function()
      .args(z.number())  // feedId
      .returns(z.array(customHonoEntrySchema)),
    updateUserNotes: z.function()
      .args(z.number(), z.string())  // entryId, newNotes
      .returns(customHonoEntrySchema),
  },
};
