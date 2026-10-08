/**
 * Client-safe shared types & display metadata for the Customer Watch app.
 *
 * The string unions here MUST stay in sync with the `$type<>()` casts in
 * src/lib/server/watch/db/schema.ts. They are duplicated (not imported) so this
 * client-safe module never pulls server-only code into the browser bundle.
 */

export type UserRole = 'admin' | 'member';

export type SignalType =
	| 'expansion'
	| 'regulatory'
	| 'earnings'
	| 'partnership'
	| 'leadership'
	| 'm_and_a'
	| 'product'
	| 'financial'
	| 'legal'
	| 'esg'
	| 'contract'
	| 'budget_cut'
	| 'other';

export type ImpactKind = 'opportunity' | 'risk' | 'neutral';
export type Sentiment = 'bullish' | 'neutral' | 'bearish';
export type RunStatus = 'queued' | 'running' | 'success' | 'error';
export type AccountSignalKind = 'watch' | 'rfb';
export type ActionKind = 'follow_up' | 'rfb';
export type ActionStatus =
	'open' | 'in_progress' | 'waiting' | 'submitted' | 'won' | 'lost' | 'done';
export type ActionPriority = 'normal' | 'high';

/** The session user shape exposed to the browser (never includes the hash). */
export interface AuthUser {
	id: string;
	email: string;
	fullName: string;
	role: UserRole;
	pod: string | null;
	title: string | null;
	mustChangePassword: boolean;
}

// --- Signal-type display (label + emoji glyph for chips) ---
export const SIGNAL_TYPES: Record<SignalType, { label: string; icon: string }> = {
	expansion: { label: 'Expansion', icon: '📈' },
	regulatory: { label: 'Regulatory', icon: '⚠️' },
	earnings: { label: 'Earnings', icon: '💰' },
	partnership: { label: 'Partnership', icon: '🤝' },
	leadership: { label: 'Leadership', icon: '👤' },
	m_and_a: { label: 'M&A', icon: '🔀' },
	product: { label: 'Product', icon: '📦' },
	financial: { label: 'Financial', icon: '📊' },
	legal: { label: 'Legal', icon: '⚖️' },
	esg: { label: 'ESG', icon: '🌱' },
	contract: { label: 'Contract', icon: '📝' },
	budget_cut: { label: 'Budget Cut', icon: '🔻' },
	other: { label: 'Update', icon: '•' }
};

export const IMPACT_KINDS: Record<ImpactKind, { label: string }> = {
	opportunity: { label: 'Opportunity' },
	risk: { label: 'Risk' },
	neutral: { label: 'Neutral' }
};

export const SENTIMENTS: Record<Sentiment, { label: string; arrow: string }> = {
	bullish: { label: 'Bullish', arrow: '↑' },
	neutral: { label: 'Neutral', arrow: '→' },
	bearish: { label: 'Bearish', arrow: '↓' }
};

export function signalLabel(t: SignalType | null | undefined): { label: string; icon: string } {
	return (t && SIGNAL_TYPES[t]) || SIGNAL_TYPES.other;
}

// ---------------------------------------------------------------------------
// View models (shape returned by +page.server loaders → components). Dates survive
// the load boundary as Date objects (SvelteKit uses devalue).
// ---------------------------------------------------------------------------
export interface AccountRef {
	id: string;
	name: string;
	slug: string;
	segment: string | null;
	ticker: string | null;
	logoUrl: string | null;
}

export interface AccountSummary extends AccountRef {
	industry: string | null;
	exchange: string | null;
	country: string | null;
	pod: string | null;
	description: string | null;
	website: string | null;
	newsCount?: number;
	lastSignalAt?: Date | null;
}

/** One additional outlet covering the same story as a feed item's lead article. */
export interface StorySource {
	id: string;
	source: string | null;
	url: string;
	title: string;
}

export interface AccountSignalRef {
	id: string;
	name: string;
	kind: AccountSignalKind;
	signalType: SignalType;
	isPriority: boolean;
	matchedTerms?: string[];
}

export interface FeedItem {
	id: string;
	title: string;
	detail: string | null;
	summary: string | null;
	url: string;
	imageUrl: string | null;
	source: string | null;
	publishedAt: Date | null;
	fetchedAt: Date;
	signalType: SignalType | null;
	impactLabel: string | null;
	impactKind: ImpactKind | null;
	sentiment: Sentiment | null;
	trendPct: number | null;
	isPriority: boolean;
	account: AccountRef;
	/** Other publishers covering the same event, collapsed into this lead (see clusterStories). */
	moreSources?: StorySource[];
	/** Admin-configured, account-specific watch signals matched to this story. */
	watchSignals?: AccountSignalRef[];
}

export interface AccountSignalView extends AccountSignalRef {
	terms: string[];
	excludeTerms: string[];
	isActive: boolean;
	matchCount: number;
	createdAt: Date;
}

export interface AccountActionView {
	id: string;
	kind: ActionKind;
	status: ActionStatus;
	priority: ActionPriority;
	title: string;
	notes: string | null;
	dueAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	newsItemId: string | null;
	newsTitle: string | null;
	newsUrl: string | null;
	signalId: string | null;
	signalName: string | null;
	assigneeName: string | null;
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
	open: 'Open',
	in_progress: 'In progress',
	waiting: 'Waiting',
	submitted: 'Submitted',
	won: 'Won',
	lost: 'Lost',
	done: 'Done'
};

export interface SegmentCount {
	key: string;
	label: string;
	icon: string;
	accent: string;
	count: number;
}

export interface Kpis {
	totalCustomers: number;
	newThisMonth: number;
	activeSignalsToday: number;
	criticalSignals: number;
	portfolioSentiment: number; // 0..100
	sentimentLabel: Sentiment;
	accountsAtRisk: number;
}

export interface SectorSentimentBar {
	key: string;
	label: string;
	score: number; // 0..100
}

export interface DashboardData {
	kpis: Kpis;
	segments: SegmentCount[];
	keySignals: FeedItem[];
	priorityAlerts: FeedItem[];
	sectorSentiment: SectorSentimentBar[];
	lastSyncAt: Date | null;
	sourcesMonitored: number;
	totalSignals: number;
}

// ---------------------------------------------------------------------------
// AI digests (Gemini summaries over the news knowledge base)
// ---------------------------------------------------------------------------
export interface DigestSignal {
	headline: string;
	account: string;
	kind: ImpactKind;
}

export interface SectorDigest {
	key: string;
	label: string;
	summary: string;
	sentiment: Sentiment;
	sentimentScore: number; // -1..1
	signals: DigestSignal[];
	accountCount: number;
	itemCount: number;
}

export interface DashboardDigest {
	portfolioSummary: string;
	portfolioSentiment: Sentiment;
	sectors: SectorDigest[];
	itemCount: number;
	generatedAt: string; // ISO
	model: string;
}

export interface AccountDigest {
	summary: string;
	sentiment: Sentiment;
	sentimentScore: number;
	signals: DigestSignal[];
	itemCount: number;
	generatedAt: string;
	model: string;
}

/** Lightweight, AI-free counts for the dashboard header. */
export interface DashboardCounts {
	totalCustomers: number;
	newThisMonth: number;
	newsToday: number;
	totalNews: number;
	sourcesMonitored: number;
	lastSyncAt: Date | null;
	segments: SegmentCount[];
}
