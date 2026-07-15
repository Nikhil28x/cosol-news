/** Fetch recent general AI/tech news (shared across all users). npx tsx scripts/general-news.ts */
import { ingestGeneralNews } from '../src/lib/server/watch/agents/general-news';

console.log('Fetching general AI/tech news…');
const r = await ingestGeneralNews({ imageCap: 60 });
console.log(`✅ found ${r.found} · fresh ${r.fresh} · images resolved ${r.images}`);
process.exit(0);
