CREATE TABLE IF NOT EXISTS "summary_job_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"daily_request_count" integer DEFAULT 0 NOT NULL,
	"token_usage_last_minute" integer DEFAULT 0 NOT NULL,
	"last_minute_reset" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"entry_id" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "summary_job_stats" ADD CONSTRAINT "summary_job_stats_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
