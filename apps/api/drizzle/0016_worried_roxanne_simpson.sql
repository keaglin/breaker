ALTER TABLE "entries" RENAME COLUMN "processed" TO "processed_for_summary";--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "processed_for_trends" boolean DEFAULT false NOT NULL;