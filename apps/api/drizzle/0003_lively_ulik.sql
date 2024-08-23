DROP TABLE "users";--> statement-breakpoint
ALTER TABLE "entries" DROP CONSTRAINT "entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "feeds" DROP CONSTRAINT "feeds_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hono_entries" DROP CONSTRAINT "hono_entries_miniflux_entry_id_entries_id_fk";
--> statement-breakpoint
ALTER TABLE "hono_feeds" DROP CONSTRAINT "hono_feeds_miniflux_feed_id_feeds_id_fk";
--> statement-breakpoint
ALTER TABLE "hono_users" DROP CONSTRAINT "hono_users_miniflux_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "feed_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "hono_entries" ALTER COLUMN "miniflux_entry_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "hono_entries" ALTER COLUMN "last_synced_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "hono_feeds" ALTER COLUMN "miniflux_feed_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "hono_feeds" ALTER COLUMN "last_synced_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "hono_users" ALTER COLUMN "last_synced_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "hono_entries" ADD COLUMN "feed_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "hono_entries" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "hono_entries" ADD COLUMN "url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "hono_entries" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "hono_feeds" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "hono_feeds" ADD COLUMN "feed_url" text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hono_entries" ADD CONSTRAINT "hono_entries_feed_id_hono_feeds_miniflux_feed_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."hono_feeds"("miniflux_feed_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "feeds" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "hono_users" DROP COLUMN IF EXISTS "miniflux_user_id";--> statement-breakpoint
ALTER TABLE "hono_entries" ADD CONSTRAINT "hono_entries_miniflux_entry_id_unique" UNIQUE("miniflux_entry_id");--> statement-breakpoint
ALTER TABLE "hono_feeds" ADD CONSTRAINT "hono_feeds_miniflux_feed_id_unique" UNIQUE("miniflux_feed_id");