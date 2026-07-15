/**
 * Daily refresh scheduler (local / self-hosted). Runs refreshAll every day at
 * REFRESH_HOUR (default 6) in the machine's LOCAL time zone — keep it running
 * (e.g. `npm run watch:scheduler`, or under pm2 / launchd / a container).
 *
 * On Vercel you don't need this — vercel.json's cron calls /watch/api/cron/ingest.
 * Pass --now to run once immediately, then continue on schedule.
 */
import { refreshAll } from '../src/lib/server/watch/agents/refresh';

const HOUR = Number(process.env.REFRESH_HOUR ?? 6); // local hour, 0-23

function msUntilNext(hour: number): number {
	const now = new Date();
	const next = new Date(now);
	next.setHours(hour, 0, 0, 0);
	if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
	return next.getTime() - now.getTime();
}

async function runOnce() {
	const t0 = Date.now();
	console.log(`[scheduler] ${new Date().toLocaleString()} — running daily refresh…`);
	try {
		const r = await refreshAll({ concurrency: 3 });
		console.log(
			`[scheduler] done: ${r.accounts} accounts · ${r.newItems} new · ${r.digests} digests · ${r.errors} errors · ${Math.round((Date.now() - t0) / 1000)}s`
		);
	} catch (err) {
		console.error('[scheduler] refresh failed:', err);
	}
}

function scheduleNext() {
	const ms = msUntilNext(HOUR);
	const at = new Date(Date.now() + ms);
	console.log(`[scheduler] next run: ${at.toLocaleString()} (in ${(ms / 3_600_000).toFixed(1)}h)`);
	setTimeout(async () => {
		await runOnce();
		scheduleNext();
	}, ms);
}

console.log(
	`[scheduler] daily news refresh at ${String(HOUR).padStart(2, '0')}:00 local time. Ctrl+C to stop.`
);
if (process.argv.includes('--now')) runOnce().then(scheduleNext);
else scheduleNext();
