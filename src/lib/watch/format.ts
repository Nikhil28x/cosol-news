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
 * Image for a news tile: the article's own image when the source provided one,
 * else a deterministic photo (stable per item id) so the magazine layout always
 * has imagery. The tile also renders an accent gradient behind, so a failed image
 * degrades gracefully.
 */
export function newsImage(item: { id: string; imageUrl?: string | null }): string {
	if (item.imageUrl) return item.imageUrl;
	const seed = item.id.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'news';
	return `https://picsum.photos/seed/${seed}/1000/640`;
}
