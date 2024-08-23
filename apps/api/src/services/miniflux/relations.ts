import { relations } from "drizzle-orm/relations";
import { users, userSessions, categories, feeds, entries, enclosures, apiKeys, webauthnCredentials, feedIcons, icons } from "./schema";

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userSessions: many(userSessions),
	categories: many(categories),
	feeds: many(feeds),
	entries: many(entries),
	enclosures: many(enclosures),
	apiKeys: many(apiKeys),
	webauthnCredentials: many(webauthnCredentials),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	user: one(users, {
		fields: [categories.userId],
		references: [users.id]
	}),
	feeds: many(feeds),
}));

export const feedsRelations = relations(feeds, ({one, many}) => ({
	user: one(users, {
		fields: [feeds.userId],
		references: [users.id]
	}),
	category: one(categories, {
		fields: [feeds.categoryId],
		references: [categories.id]
	}),
	entries: many(entries),
	feedIcons: many(feedIcons),
}));

export const entriesRelations = relations(entries, ({one, many}) => ({
	user: one(users, {
		fields: [entries.userId],
		references: [users.id]
	}),
	feed: one(feeds, {
		fields: [entries.feedId],
		references: [feeds.id]
	}),
	enclosures: many(enclosures),
}));

export const enclosuresRelations = relations(enclosures, ({one}) => ({
	user: one(users, {
		fields: [enclosures.userId],
		references: [users.id]
	}),
	entry: one(entries, {
		fields: [enclosures.entryId],
		references: [entries.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const webauthnCredentialsRelations = relations(webauthnCredentials, ({one}) => ({
	user: one(users, {
		fields: [webauthnCredentials.userId],
		references: [users.id]
	}),
}));

export const feedIconsRelations = relations(feedIcons, ({one}) => ({
	feed: one(feeds, {
		fields: [feedIcons.feedId],
		references: [feeds.id]
	}),
	icon: one(icons, {
		fields: [feedIcons.iconId],
		references: [icons.id]
	}),
}));

export const iconsRelations = relations(icons, ({many}) => ({
	feedIcons: many(feedIcons),
}));