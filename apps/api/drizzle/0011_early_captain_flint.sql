DROP TABLE "hono_users";--> statement-breakpoint
ALTER TABLE "hono_entries" RENAME TO "entries";--> statement-breakpoint
ALTER TABLE "hono_feeds" RENAME TO "feeds";--> statement-breakpoint
ALTER TABLE "entries" RENAME COLUMN "miniflux_entry_id" TO "miniflux_id";--> statement-breakpoint
ALTER TABLE "feeds" RENAME COLUMN "miniflux_feed_id" TO "miniflux_id";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "hono_entries_miniflux_entry_id_unique";--> statement-breakpoint
ALTER TABLE "feeds" DROP CONSTRAINT "hono_feeds_miniflux_feed_id_unique";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "hono_entries_feed_id_hono_feeds_miniflux_feed_id_fk";
--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "feed_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "feed_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "last_synced_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "author" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "takeaways" text[];--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "site_url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entries" ADD CONSTRAINT "entries_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN IF EXISTS "user_notes";--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN IF EXISTS "custom_tags";--> statement-breakpoint
ALTER TABLE "feeds" DROP COLUMN IF EXISTS "published_at";--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_miniflux_id_unique" UNIQUE("miniflux_id");--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_miniflux_id_unique" UNIQUE("miniflux_id");