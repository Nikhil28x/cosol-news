import { segmentDef } from './segments';

export function initials(name: string): string {
	const parts = name
		.replace(/[^A-Za-z0-9 ]/g, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (!parts.length) return '?';
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function monogramColor(segment: string | null | undefined): string {
	return segmentDef(segment).accent;
}

export function relativeTime(d: Date | string | null | undefined): string {
	if (!d) return '';
	const date = typeof d === 'string' ? new Date(d) : d;
	const sec = Math.floor((Date.now() - date.getTime()) / 1000);
	if (sec < 45) return 'just now';
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min} min ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	if (day < 7) return `${day}d ago`;
	return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function formatDate(d: Date | string | null | undefined): string {
	if (!d) return '—';
	const date = typeof d === 'string' ? new Date(d) : d;
	return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Real article image for a news tile (resolved from the publisher's og:image during
 * ingest), or null — in which case the tile shows its industry-accent gradient. No
 * random placeholder photos.
 */
export function newsImage(item: { imageUrl?: string | null }): string | null {
	return item.imageUrl ?? null;
}

// Themed stock placeholders (in static/stock/) used when a news item has no fetched
// image. One per segment; unknown segments fall back to "other".
const STOCK_SEGMENTS = new Set([
	'financial_services',
	'government_public',
	'technology',
	'manufacturing',
	'pharma_healthcare',
	'professional_services',
	'telecom_media',
	'other'
]);

export function stockImage(segment: string | null | undefined): string {
	const key = segment && STOCK_SEGMENTS.has(segment) ? segment : 'other';
	return `/stock/${key}.jpg`;
}
