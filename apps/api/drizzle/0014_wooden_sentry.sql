DROP INDEX IF EXISTS "time_keyword_idx";--> statement-breakpoint
ALTER TABLE "trends" ADD CONSTRAINT "trends_time_keyword_pk" PRIMARY KEY("time","keyword");--> statement-breakpoint
ALTER TABLE "trends" DROP COLUMN IF EXISTS "id";