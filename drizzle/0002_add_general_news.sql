CREATE TABLE "general_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"image_url" text,
	"source" text,
	"summary" text,
	"topic" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "general_news_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE INDEX "general_news_published_idx" ON "general_news" USING btree ("published_at");