ALTER TABLE "hono_entries" RENAME COLUMN "miniflux_entry_id" TO "miniflux_entry_id::integer";--> statement-breakpoint
ALTER TABLE "hono_feeds" RENAME COLUMN "miniflux_feed_id" TO "miniflux_feed_id::integer";--> statement-breakpoint
ALTER TABLE "hono_entries" DROP CONSTRAINT "hono_entries_miniflux_entry_id_unique";--> statement-breakpoint
ALTER TABLE "hono_feeds" DROP CONSTRAINT "hono_feeds_miniflux_feed_id_unique";--> statement-breakpoint
ALTER TABLE "hono_entries" DROP CONSTRAINT "hono_entries_feed_id_hono_feeds_miniflux_feed_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hono_entries" ADD CONSTRAINT "hono_entries_feed_id_hono_feeds_miniflux_feed_id::integer_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."hono_feeds"("miniflux_feed_id::integer") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "hono_entries" ADD CONSTRAINT "hono_entries_miniflux_entry_id::integer_unique" UNIQUE("miniflux_entry_id::integer");--> statement-breakpoint
ALTER TABLE "hono_feeds" ADD CONSTRAINT "hono_feeds_miniflux_feed_id::integer_unique" UNIQUE("miniflux_feed_id::integer");