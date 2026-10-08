-- Re-evaluate existing rows with the final positive business vocabulary. Keeping this
-- as a separate migration also corrects databases where 0003 was applied before the
-- strict gate's generic "project" marker was removed.
UPDATE "news_items" SET "business_relevant" = false;--> statement-breakpoint
UPDATE "news_items"
SET "business_relevant" = true
WHERE lower(coalesce("title", '') || ' ' || coalesce("summary", '')) ~
	'(revenue|earnings|profit|quarterly|results|guidance|dividend|ebitda|shares|stock|investor|ipo|valuation|acquisition|merger|takeover|funding|contract|tender|request for bid|request for proposal|invitation to bid|rfb|rfp|rfq|procurement|order book|purchase order|partnership|joint venture|customer|client|product|platform|lawsuit|litigation|settlement|regulator|compliance|tariff|export|import|supply chain|manufactur|factory|plant|facility|capacity|expansion|investment|capex|digital transformation|technology|software|cloud|cybersecurity|data centre|data center|erp|sap|oracle|layoff|workforce|ceo|cfo|coo|chairman|chairperson|managing director|board|appoint|resign|clinical|trial|fda|drug|medicine|vaccine|therapy|oncology|hospital|healthcare|diagnostic|pharma|recall|approval|banking|deposits|loans|rbi|sebi|sponsor|employees|staff|workplace|fraud|bribery|money laundering|data breach)';--> statement-breakpoint
-- Preserve account-signal matches created before this migration is applied.
UPDATE "news_items"
SET "business_relevant" = true
WHERE "id" IN (SELECT "news_item_id" FROM "news_signal_matches");--> statement-breakpoint
-- Decisive sports/racing name collisions are never business news for a tracked account.
UPDATE "news_items"
SET "business_relevant" = false
WHERE lower(coalesce("title", '') || ' ' || coalesce("summary", '')) ~
	'(leverkusen|bundesliga|la liga|serie a|ligue 1|eredivisie|champions league|europa league|uefa|fifa|indian super league|i-league|matchday|midfielder|goalkeeper|striker|winger|centre-back|center-back|transfer window|transfer fee|penalty shoot-out|penalty shootout|clean sheet|jockey|racecourse|racehorse|gelding|filly|maiden stakes|handicap chase|caulfield cup|derby winner|goodwood|ascot|cheltenham|epsom|racing post)';
