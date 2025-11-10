import {supabase} from '../db/client.js';
import {generateEmbedding} from './embeddings.js';

export type SearchOptions = {
	essayId?: string;
	limit?: number;
	threshold?: number;
	rerank?: boolean;
	filterMetadata?: Record<string, unknown>;
};

export type SearchResult = {
	id: string;
	sourceId: string;
	content: string;
	chunkIndex: number;
	similarity: number;
	sourceTitle: string;
	sourceUrl: string;
	sourceSummary: string;
	dateAccessed: Date | null;
	searchQuery: string | null;
	headingContext?: string;
	metadata?: Record<string, unknown>;
};

function preprocessQuery(query: string): string {
	const stopWords = [
		'the',
		'a',
		'an',
		'and',
		'or',
		'but',
		'in',
		'on',
		'at',
		'to',
	];

	let processed = query.toLowerCase();

	processed = processed.replace(/[^\w\s\-']/g, ' ');

	if (processed.split(' ').length > 5) {
		const words = processed.split(' ');
		processed = words
			.filter(word => !stopWords.includes(word) || word.length > 2)
			.join(' ');
	}

	return processed.trim();
}

function rerankResults(
	query: string,
	results: SearchResult[],
): SearchResult[] {
	const queryTerms = query.toLowerCase().split(' ');

	return results.sort((a, b) => {
		const aKeywordScore = queryTerms.reduce((score, term) => {
			return score + (a.content.toLowerCase().includes(term) ? 0.05 : 0);
		}, 0);

		const bKeywordScore = queryTerms.reduce((score, term) => {
			return score + (b.content.toLowerCase().includes(term) ? 0.05 : 0);
		}, 0);

		const aFinalScore = a.similarity + aKeywordScore;
		const bFinalScore = b.similarity + bKeywordScore;

		return bFinalScore - aFinalScore;
	});
}

export async function enhancedSearch(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResult[]> {
	const processedQuery = preprocessQuery(query);

	const embedding = await generateEmbedding(processedQuery, {
		inputType: 'query',
	});

	const {data, error} = await supabase.rpc('match_source_chunks_enhanced', {
		query_embedding: JSON.stringify(embedding),
		match_threshold: options.threshold ?? 0.7,
		match_count: options.limit ?? 10,
		essay_id: options.essayId ?? null,
		metadata_filter: options.filterMetadata
			? JSON.stringify(options.filterMetadata)
			: null,
	});

	if (error) {
		throw error;
	}

	const results = (data ?? []).map(
		(row: {
			id: string;
			source_id: string;
			content: string;
			chunk_index: number;
			similarity: number;
			source_title: string;
			source_url: string;
			source_summary: string;
			date_accessed: string | null;
			search_query: string | null;
			heading_context: string | null;
			metadata: Record<string, unknown> | null;
		}) => ({
			id: row.id,
			sourceId: row.source_id,
			content: row.content,
			chunkIndex: row.chunk_index,
			similarity: row.similarity,
			sourceTitle: row.source_title,
			sourceUrl: row.source_url,
			sourceSummary: row.source_summary,
			dateAccessed: row.date_accessed ? new Date(row.date_accessed) : null,
			searchQuery: row.search_query,
			headingContext: row.heading_context ?? undefined,
			metadata: row.metadata ?? undefined,
		}),
	);

	if (options.rerank && results.length > 0) {
		return rerankResults(query, results);
	}

	return results;
}

export async function searchSourceChunks(
	query: string,
	options: Omit<SearchOptions, 'rerank' | 'filterMetadata'> = {},
): Promise<
	Array<{
		id: string;
		sourceId: string;
		content: string;
		chunkIndex: number;
		similarity: number;
		sourceTitle: string;
		sourceUrl: string;
	}>
> {
	const processedQuery = preprocessQuery(query);

	const embedding = await generateEmbedding(processedQuery, {
		inputType: 'query',
	});

	const {data, error} = await supabase.rpc('match_source_chunks', {
		query_embedding: JSON.stringify(embedding),
		match_threshold: options.threshold ?? 0.7,
		match_count: options.limit ?? 10,
	});

	if (error) {
		throw error;
	}

	return (data ?? []).map(
		(row: {
			id: string;
			source_id: string;
			content: string;
			chunk_index: number;
			similarity: number;
			source_title: string;
			source_url: string;
		}) => ({
			id: row.id,
			sourceId: row.source_id,
			content: row.content,
			chunkIndex: row.chunk_index,
			similarity: row.similarity,
			sourceTitle: row.source_title,
			sourceUrl: row.source_url,
		}),
	);
}
