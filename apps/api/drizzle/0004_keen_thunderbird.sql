DROP TABLE "entries";--> statement-breakpoint
DROP TABLE "feeds";--> statement-breakpoint
ALTER TABLE "hono_entries" ALTER COLUMN "miniflux_entry_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "hono_entries" ALTER COLUMN "feed_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "hono_feeds" ALTER COLUMN "miniflux_feed_id" SET DATA TYPE text;