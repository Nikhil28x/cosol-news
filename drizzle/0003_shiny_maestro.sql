CREATE TABLE "account_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"news_item_id" uuid,
	"account_signal_id" uuid,
	"kind" text DEFAULT 'follow_up' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"assigned_to" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'watch' NOT NULL,
	"signal_type" text DEFAULT 'other' NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_priority" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_signal_matches" (
	"news_item_id" uuid NOT NULL,
	"account_signal_id" uuid NOT NULL,
	"matched_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_signal_matches_news_item_id_account_signal_id_pk" PRIMARY KEY("news_item_id","account_signal_id")
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "business_relevant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill the existing knowledge base through the new positive business gate. Future
-- ingestion uses the richer TypeScript matcher (including account-specific signals).
UPDATE "news_items"
SET "business_relevant" = true
WHERE lower(coalesce("title", '') || ' ' || coalesce("summary", '')) ~
	'(revenue|earnings|profit|quarterly|results|guidance|dividend|ebitda|shares|stock|investor|ipo|valuation|acquisition|merger|takeover|funding|contract|tender|request for bid|request for proposal|invitation to bid|rfb|rfp|rfq|procurement|order book|purchase order|partnership|joint venture|customer|client|product|platform|lawsuit|litigation|settlement|regulator|compliance|tariff|export|import|supply chain|manufactur|factory|plant|facility|capacity|expansion|investment|capex|digital transformation|technology|software|cloud|cybersecurity|data centre|data center|erp|sap|oracle|layoff|workforce|ceo|cfo|coo|chairman|chairperson|managing director|board|appoint|resign|clinical|trial|fda|drug|medicine|vaccine|therapy|oncology|hospital|healthcare|diagnostic|pharma|recall|approval|banking|deposits|loans|rbi|sebi|sponsor|employees|staff|workplace|fraud|bribery|money laundering|data breach)';--> statement-breakpoint
-- Decisive name-collision noise never survives, even if sports copy says "deal" or
-- "contract". Softer sports/entertainment language is handled by the application gate.
UPDATE "news_items"
SET "business_relevant" = false
WHERE lower(coalesce("title", '') || ' ' || coalesce("summary", '')) ~
	'(leverkusen|bundesliga|la liga|serie a|ligue 1|eredivisie|champions league|europa league|uefa|fifa|indian super league|i-league|matchday|midfielder|goalkeeper|striker|winger|centre-back|center-back|transfer window|transfer fee|penalty shoot-out|penalty shootout|clean sheet|jockey|racecourse|racehorse|gelding|filly|maiden stakes|handicap chase|caulfield cup|derby winner|goodwood|ascot|cheltenham|epsom|racing post)';--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_news_item_id_news_items_id_fk" FOREIGN KEY ("news_item_id") REFERENCES "public"."news_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_account_signal_id_account_signals_id_fk" FOREIGN KEY ("account_signal_id") REFERENCES "public"."account_signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_actions" ADD CONSTRAINT "account_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_signals" ADD CONSTRAINT "account_signals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_signals" ADD CONSTRAINT "account_signals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_signal_matches" ADD CONSTRAINT "news_signal_matches_news_item_id_news_items_id_fk" FOREIGN KEY ("news_item_id") REFERENCES "public"."news_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_signal_matches" ADD CONSTRAINT "news_signal_matches_account_signal_id_account_signals_id_fk" FOREIGN KEY ("account_signal_id") REFERENCES "public"."account_signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_actions_account_idx" ON "account_actions" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "account_actions_due_idx" ON "account_actions" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "account_actions_news_idx" ON "account_actions" USING btree ("news_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_signals_account_name_uniq" ON "account_signals" USING btree ("account_id","name");--> statement-breakpoint
CREATE INDEX "account_signals_account_idx" ON "account_signals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_signals_active_idx" ON "account_signals" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "news_signal_matches_signal_idx" ON "news_signal_matches" USING btree ("account_signal_id");
