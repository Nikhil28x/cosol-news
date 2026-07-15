/** Resolve real article images for recent items. npx tsx scripts/enrich-images.ts [cap] */
import { enrichImagesForRecent } from '../src/lib/server/watch/agents/images';

const cap = Number(process.argv[2] ?? 200);
console.log(`Resolving real images for up to ${cap} recent items…`);
const r = await enrichImagesForRecent({ cap, concurrency: 8 });
console.log(
	`✅ scanned ${r.scanned}, resolved ${r.resolved} (${Math.round((r.resolved / Math.max(1, r.scanned)) * 100)}%)`
);
process.exit(0);
