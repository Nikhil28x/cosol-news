import type { Enricher } from '../types';
import { heuristicEnricher } from './heuristics';
import { openRouterEnricher } from './openrouter';

/**
 * Pick the enricher: OpenRouter when a key is present (it falls back to heuristics
 * internally on failure), otherwise the deterministic heuristic classifier.
 */
export function getEnricher(): Enricher {
	return process.env.OPENROUTER_API_KEY ? openRouterEnricher : heuristicEnricher;
}

export { heuristicEnricher, openRouterEnricher };
