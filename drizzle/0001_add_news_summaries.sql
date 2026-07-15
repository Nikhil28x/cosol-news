CREATE TABLE "news_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"scope_key" text NOT NULL,
	"day" date NOT NULL,
	"payload" jsonb NOT NULL,
	"model" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_summaries_uniq" ON "news_summaries" USING btree ("kind","scope_key","day");