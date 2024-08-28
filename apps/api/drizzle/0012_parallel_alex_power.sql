CREATE TABLE IF NOT EXISTS "sync_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_synced_id" integer,
	"success" boolean NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trends" (
	"id" text PRIMARY KEY NOT NULL,
	"time" timestamp NOT NULL,
	"trend_type" text NOT NULL,
	"keyword" text NOT NULL,
	"frequency" integer NOT NULL,
	"burst_score" real,
	"data" text
);
--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "updated_at" DROP DEFAULT;