CREATE TABLE IF NOT EXISTS "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"feed_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"feed_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hono_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"miniflux_entry_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"user_notes" text,
	"custom_tags" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hono_feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"miniflux_feed_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hono_users" (
	"id" text PRIMARY KEY NOT NULL,
	"miniflux_user_id" integer NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entries" ADD CONSTRAINT "entries_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feeds" ADD CONSTRAINT "feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hono_entries" ADD CONSTRAINT "hono_entries_miniflux_entry_id_entries_id_fk" FOREIGN KEY ("miniflux_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hono_feeds" ADD CONSTRAINT "hono_feeds_miniflux_feed_id_feeds_id_fk" FOREIGN KEY ("miniflux_feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hono_users" ADD CONSTRAINT "hono_users_miniflux_user_id_users_id_fk" FOREIGN KEY ("miniflux_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
