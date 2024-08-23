ALTER TABLE "hono_entries" ALTER COLUMN "miniflux_entry_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "hono_feeds" ALTER COLUMN "miniflux_feed_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "hono_users" ALTER COLUMN "miniflux_user_id" SET DATA TYPE text;