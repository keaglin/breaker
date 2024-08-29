CREATE TABLE IF NOT EXISTS "hourly_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_hour" timestamp NOT NULL,
	"processed_at" timestamp,
	"entry_count" integer NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DROP TABLE "sync_metadata";