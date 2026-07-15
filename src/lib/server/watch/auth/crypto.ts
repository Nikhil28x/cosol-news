import { createHash, randomBytes } from 'node:crypto';

/** Opaque session token for the cookie (~192 bits, URL-safe). */
export function randomToken(): string {
	return randomBytes(24).toString('base64url');
}

/** Session row id = sha256(token) hex. The raw token never touches the DB. */
export function sha256hex(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

/** Stable hash of a canonicalised URL, used to dedupe news items per account. */
export function urlHash(url: string): string {
	let u = url.trim();
	try {
		const parsed = new URL(u);
		parsed.hash = '';
		// drop common tracking params
		for (const p of [...parsed.searchParams.keys()]) {
			if (/^utm_|^fbclid$|^gclid$|^ref$|^oc$/i.test(p)) parsed.searchParams.delete(p);
		}
		u = parsed.toString().replace(/\/$/, '');
	} catch {
		// non-URL string — hash as-is
	}
	return sha256hex(u.toLowerCase());
}
