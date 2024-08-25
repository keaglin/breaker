import { pgTable, pgEnum, text, foreignKey, unique, serial, integer, timestamp, inet, boolean, index, bigserial, uniqueIndex, numeric, bigint, jsonb, varchar, primaryKey } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const entrySortingDirection = pgEnum("entry_sorting_direction", ['asc', 'desc'])
export const entrySortingOrder = pgEnum("entry_sorting_order", ['published_at', 'created_at'])
export const entryStatus = pgEnum("entry_status", ['unread', 'read', 'removed'])
export const webappDisplayMode = pgEnum("webapp_display_mode", ['fullscreen', 'standalone', 'minimal-ui', 'browser'])


export const schemaVersion = pgTable("schema_version", {
	version: text("version").notNull(),
});

export const userSessions = pgTable("user_sessions", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userAgent: text("user_agent"),
	ip: inet("ip"),
},
(table) => {
	return {
		sessionsUserIdTokenKey: unique("sessions_user_id_token_key").on(table.userId, table.token),
		sessionsTokenKey: unique("sessions_token_key").on(table.token),
	}
});

export const categories = pgTable("categories", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	title: text("title").notNull(),
	hideGlobally: boolean("hide_globally").default(false).notNull(),
},
(table) => {
	return {
		categoriesUserIdTitleKey: unique("categories_user_id_title_key").on(table.userId, table.title),
	}
});

export const feeds = pgTable("feeds", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" } ),
	title: text("title").notNull(),
	feedUrl: text("feed_url").notNull(),
	siteUrl: text("site_url").notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	etagHeader: text("etag_header").default(''),
	lastModifiedHeader: text("last_modified_header").default(''),
	parsingErrorMsg: text("parsing_error_msg").default(''),
	parsingErrorCount: integer("parsing_error_count").default(0),
	scraperRules: text("scraper_rules").default(''),
	rewriteRules: text("rewrite_rules").default(''),
	crawler: boolean("crawler").default(false),
	username: text("username").default(''),
	password: text("password").default(''),
	userAgent: text("user_agent").default(''),
	disabled: boolean("disabled").default(false),
	nextCheckAt: timestamp("next_check_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	ignoreHttpCache: boolean("ignore_http_cache").default(false),
	fetchViaProxy: boolean("fetch_via_proxy").default(false),
	blocklistRules: text("blocklist_rules").default('').notNull(),
	keeplistRules: text("keeplist_rules").default('').notNull(),
	allowSelfSignedCertificates: boolean("allow_self_signed_certificates").default(false).notNull(),
	cookie: text("cookie").default(''),
	hideGlobally: boolean("hide_globally").default(false).notNull(),
	urlRewriteRules: text("url_rewrite_rules").default('').notNull(),
	noMediaPlayer: boolean("no_media_player").default(false),
	appriseServiceUrls: text("apprise_service_urls").default(''),
	disableHttp2: boolean("disable_http2").default(false),
	description: text("description").default(''),
	ntfyEnabled: boolean("ntfy_enabled").default(false),
	ntfyPriority: integer("ntfy_priority").default(3),
},
(table) => {
	return {
		feedIdHideGloballyIdx: index("feeds_feed_id_hide_globally_idx").using("btree", table.id, table.hideGlobally),
		userCategoryIdx: index("feeds_user_category_idx").using("btree", table.userId, table.categoryId),
		feedsUserIdFeedUrlKey: unique("feeds_user_id_feed_url_key").on(table.userId, table.feedUrl),
	}
});

export const users = pgTable("users", {
	id: serial("id").primaryKey().notNull(),
	username: text("username").notNull(),
	password: text("password"),
	isAdmin: boolean("is_admin").default(false),
	language: text("language").default('en_US'),
	timezone: text("timezone").default('UTC'),
	theme: text("theme").default('light_serif'),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	entryDirection: entrySortingDirection("entry_direction").default('asc'),
	keyboardShortcuts: boolean("keyboard_shortcuts").default(true),
	entriesPerPage: integer("entries_per_page").default(100),
	showReadingTime: boolean("show_reading_time").default(true),
	entrySwipe: boolean("entry_swipe").default(true),
	stylesheet: text("stylesheet").default('').notNull(),
	googleId: text("google_id").default('').notNull(),
	openidConnectId: text("openid_connect_id").default('').notNull(),
	displayMode: webappDisplayMode("display_mode").default('standalone'),
	entryOrder: entrySortingOrder("entry_order").default('published_at'),
	defaultReadingSpeed: integer("default_reading_speed").default(265),
	cjkReadingSpeed: integer("cjk_reading_speed").default(500),
	defaultHomePage: text("default_home_page").default('unread'),
	categoriesSortingOrder: text("categories_sorting_order").default('unread_count').notNull(),
	gestureNav: text("gesture_nav").default('tap'),
	markReadOnView: boolean("mark_read_on_view").default(true),
	mediaPlaybackRate: numeric("media_playback_rate").default('1'),
	blockFilterEntryRules: text("block_filter_entry_rules").default('').notNull(),
	keepFilterEntryRules: text("keep_filter_entry_rules").default('').notNull(),
	markReadOnMediaPlayerCompletion: boolean("mark_read_on_media_player_completion").default(false),
},
(table) => {
	return {
		googleIdIdx: uniqueIndex("users_google_id_idx").using("btree", table.googleId).where(sql`(google_id <> ''::text)`),
		openidConnectIdIdx: uniqueIndex("users_openid_connect_id_idx").using("btree", table.openidConnectId).where(sql`(openid_connect_id <> ''::text)`),
		usersUsernameKey: unique("users_username_key").on(table.username),
	}
});

export const entries = pgTable("entries", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	feedId: bigint("feed_id", { mode: "number" }).notNull().references(() => feeds.id, { onDelete: "cascade" } ),
	hash: text("hash").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }).notNull(),
	title: text("title").notNull(),
	url: text("url").notNull(),
	author: text("author"),
	content: text("content"),
	status: entryStatus("status").default('unread'),
	starred: boolean("starred").default(false),
	commentsUrl: text("comments_url").default(''),
	// TODO: failed to parse database type 'tsvector'
	documentVectors: unknown("document_vectors"),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).notNull(),
	shareCode: text("share_code").default('').notNull(),
	readingTime: integer("reading_time").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	tags: text("tags").default('{}').array(),
},
(table) => {
	return {
		documentVectorsIdx: index("document_vectors_idx").using("gin", table.documentVectors),
		feedIdStatusHashIdx: index("entries_feed_id_status_hash_idx").using("btree", table.feedId, table.status, table.hash),
		feedIdx: index("entries_feed_idx").using("btree", table.feedId),
		idUserStatusIdx: index("entries_id_user_status_idx").using("btree", table.id, table.userId, table.status),
		shareCodeIdx: uniqueIndex("entries_share_code_idx").using("btree", table.shareCode).where(sql`(share_code <> ''::text)`),
		userFeedIdx: index("entries_user_feed_idx").using("btree", table.userId, table.feedId),
		userIdStatusStarredIdx: index("entries_user_id_status_starred_idx").using("btree", table.userId, table.status, table.starred),
		userStatusChangedIdx: index("entries_user_status_changed_idx").using("btree", table.userId, table.status, table.changedAt),
		userStatusChangedPublishedIdx: index("entries_user_status_changed_published_idx").using("btree", table.userId, table.status, table.changedAt, table.publishedAt),
		userStatusCreatedIdx: index("entries_user_status_created_idx").using("btree", table.userId, table.status, table.createdAt),
		userStatusFeedIdx: index("entries_user_status_feed_idx").using("btree", table.userId, table.status, table.feedId),
		userStatusIdx: index("entries_user_status_idx").using("btree", table.userId, table.status),
		userStatusPublishedIdx: index("entries_user_status_published_idx").using("btree", table.userId, table.status, table.publishedAt),
		entriesFeedIdHashKey: unique("entries_feed_id_hash_key").on(table.feedId, table.hash),
	}
});

export const enclosures = pgTable("enclosures", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	entryId: bigint("entry_id", { mode: "number" }).notNull().references(() => entries.id, { onDelete: "cascade" } ),
	url: text("url").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	size: bigint("size", { mode: "number" }).default(0),
	mimeType: text("mime_type").default(''),
	mediaProgression: integer("media_progression").default(0),
},
(table) => {
	return {
		entryIdIdx: index("enclosures_entry_id_idx").using("btree", table.entryId),
		userEntryUrlUniqueIdx: uniqueIndex("enclosures_user_entry_url_unique_idx").using("btree", sql`user_id`, sql`entry_id`, sql`null`),
	}
});

export const icons = pgTable("icons", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	hash: text("hash").notNull(),
	mimeType: text("mime_type").notNull(),
	// TODO: failed to parse database type 'bytea'
	content: unknown("content").notNull(),
},
(table) => {
	return {
		iconsHashKey: unique("icons_hash_key").on(table.hash),
	}
});

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey().notNull(),
	data: jsonb("data").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
	id: serial("id").primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	description: text("description").notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		apiKeysUserIdDescriptionKey: unique("api_keys_user_id_description_key").on(table.userId, table.description),
		apiKeysTokenKey: unique("api_keys_token_key").on(table.token),
	}
});

export const acmeCache = pgTable("acme_cache", {
	key: varchar("key", { length: 400 }).primaryKey().notNull(),
	// TODO: failed to parse database type 'bytea'
	data: unknown("data").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const webauthnCredentials = pgTable("webauthn_credentials", {
	// TODO: failed to parse database type 'bytea'
	handle: unknown("handle").primaryKey().notNull(),
	// TODO: failed to parse database type 'bytea'
	credId: unknown("cred_id").notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	// TODO: failed to parse database type 'bytea'
	publicKey: unknown("public_key").notNull(),
	attestationType: varchar("attestation_type", { length: 255 }).notNull(),
	// TODO: failed to parse database type 'bytea'
	aaguid: unknown("aaguid"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	signCount: bigint("sign_count", { mode: "number" }),
	cloneWarning: boolean("clone_warning"),
	name: text("name"),
	addedOn: timestamp("added_on", { withTimezone: true, mode: 'string' }).defaultNow(),
	lastSeenOn: timestamp("last_seen_on", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		webauthnCredentialsCredIdKey: unique("webauthn_credentials_cred_id_key").on(table.credId),
	}
});

export const integrations = pgTable("integrations", {
	userId: integer("user_id").primaryKey().notNull(),
	pinboardEnabled: boolean("pinboard_enabled").default(false),
	pinboardToken: text("pinboard_token").default(''),
	pinboardTags: text("pinboard_tags").default('miniflux'),
	pinboardMarkAsUnread: boolean("pinboard_mark_as_unread").default(false),
	instapaperEnabled: boolean("instapaper_enabled").default(false),
	instapaperUsername: text("instapaper_username").default(''),
	instapaperPassword: text("instapaper_password").default(''),
	feverEnabled: boolean("fever_enabled").default(false),
	feverUsername: text("fever_username").default(''),
	feverToken: text("fever_token").default(''),
	wallabagEnabled: boolean("wallabag_enabled").default(false),
	wallabagUrl: text("wallabag_url").default(''),
	wallabagClientId: text("wallabag_client_id").default(''),
	wallabagClientSecret: text("wallabag_client_secret").default(''),
	wallabagUsername: text("wallabag_username").default(''),
	wallabagPassword: text("wallabag_password").default(''),
	nunuxKeeperEnabled: boolean("nunux_keeper_enabled").default(false),
	nunuxKeeperUrl: text("nunux_keeper_url").default(''),
	nunuxKeeperApiKey: text("nunux_keeper_api_key").default(''),
	pocketEnabled: boolean("pocket_enabled").default(false),
	pocketAccessToken: text("pocket_access_token").default(''),
	pocketConsumerKey: text("pocket_consumer_key").default(''),
	telegramBotEnabled: boolean("telegram_bot_enabled").default(false),
	telegramBotToken: text("telegram_bot_token").default(''),
	telegramBotChatId: text("telegram_bot_chat_id").default(''),
	googlereaderEnabled: boolean("googlereader_enabled").default(false),
	googlereaderUsername: text("googlereader_username").default(''),
	googlereaderPassword: text("googlereader_password").default(''),
	espialEnabled: boolean("espial_enabled").default(false),
	espialUrl: text("espial_url").default(''),
	espialApiKey: text("espial_api_key").default(''),
	espialTags: text("espial_tags").default('miniflux'),
	linkdingEnabled: boolean("linkding_enabled").default(false),
	linkdingUrl: text("linkding_url").default(''),
	linkdingApiKey: text("linkding_api_key").default(''),
	wallabagOnlyUrl: boolean("wallabag_only_url").default(false),
	matrixBotEnabled: boolean("matrix_bot_enabled").default(false),
	matrixBotUser: text("matrix_bot_user").default(''),
	matrixBotPassword: text("matrix_bot_password").default(''),
	matrixBotUrl: text("matrix_bot_url").default(''),
	matrixBotChatId: text("matrix_bot_chat_id").default(''),
	linkdingTags: text("linkding_tags").default(''),
	linkdingMarkAsUnread: boolean("linkding_mark_as_unread").default(false),
	notionEnabled: boolean("notion_enabled").default(false),
	notionToken: text("notion_token").default(''),
	notionPageId: text("notion_page_id").default(''),
	readwiseEnabled: boolean("readwise_enabled").default(false),
	readwiseApiKey: text("readwise_api_key").default(''),
	appriseEnabled: boolean("apprise_enabled").default(false),
	appriseUrl: text("apprise_url").default(''),
	appriseServicesUrl: text("apprise_services_url").default(''),
	shioriEnabled: boolean("shiori_enabled").default(false),
	shioriUrl: text("shiori_url").default(''),
	shioriUsername: text("shiori_username").default(''),
	shioriPassword: text("shiori_password").default(''),
	shaarliEnabled: boolean("shaarli_enabled").default(false),
	shaarliUrl: text("shaarli_url").default(''),
	shaarliApiSecret: text("shaarli_api_secret").default(''),
	webhookEnabled: boolean("webhook_enabled").default(false),
	webhookUrl: text("webhook_url").default(''),
	webhookSecret: text("webhook_secret").default(''),
	telegramBotTopicId: integer("telegram_bot_topic_id"),
	telegramBotDisableWebPagePreview: boolean("telegram_bot_disable_web_page_preview").default(false),
	telegramBotDisableNotification: boolean("telegram_bot_disable_notification").default(false),
	telegramBotDisableButtons: boolean("telegram_bot_disable_buttons").default(false),
	rssbridgeEnabled: boolean("rssbridge_enabled").default(false),
	rssbridgeUrl: text("rssbridge_url").default(''),
	omnivoreEnabled: boolean("omnivore_enabled").default(false),
	omnivoreApiKey: text("omnivore_api_key").default(''),
	omnivoreUrl: text("omnivore_url").default(''),
	linkaceEnabled: boolean("linkace_enabled").default(false),
	linkaceUrl: text("linkace_url").default(''),
	linkaceApiKey: text("linkace_api_key").default(''),
	linkaceTags: text("linkace_tags").default(''),
	linkaceIsPrivate: boolean("linkace_is_private").default(true),
	linkaceCheckDisabled: boolean("linkace_check_disabled").default(true),
	linkwardenEnabled: boolean("linkwarden_enabled").default(false),
	linkwardenUrl: text("linkwarden_url").default(''),
	linkwardenApiKey: text("linkwarden_api_key").default(''),
	readeckEnabled: boolean("readeck_enabled").default(false),
	readeckOnlyUrl: boolean("readeck_only_url").default(false),
	readeckUrl: text("readeck_url").default(''),
	readeckApiKey: text("readeck_api_key").default(''),
	readeckLabels: text("readeck_labels").default(''),
	raindropEnabled: boolean("raindrop_enabled").default(false),
	raindropToken: text("raindrop_token").default(''),
	raindropCollectionId: text("raindrop_collection_id").default(''),
	raindropTags: text("raindrop_tags").default(''),
	betulaUrl: text("betula_url").default(''),
	betulaToken: text("betula_token").default(''),
	betulaEnabled: boolean("betula_enabled").default(false),
	ntfyEnabled: boolean("ntfy_enabled").default(false),
	ntfyUrl: text("ntfy_url").default(''),
	ntfyTopic: text("ntfy_topic").default(''),
	ntfyApiToken: text("ntfy_api_token").default(''),
	ntfyUsername: text("ntfy_username").default(''),
	ntfyPassword: text("ntfy_password").default(''),
	ntfyIconUrl: text("ntfy_icon_url").default(''),
});

export const feedIcons = pgTable("feed_icons", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	feedId: bigint("feed_id", { mode: "number" }).notNull().references(() => feeds.id, { onDelete: "cascade" } ),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	iconId: bigint("icon_id", { mode: "number" }).notNull().references(() => icons.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		feedIconsPkey: primaryKey({ columns: [table.feedId, table.iconId], name: "feed_icons_pkey"}),
	}
});