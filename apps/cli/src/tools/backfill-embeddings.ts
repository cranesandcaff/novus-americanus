import pLimit from 'p-limit';
import {sources, sourceChunks} from '../db/queries.js';
import {semanticChunk, semanticChunkGenerator} from './chunking.js';
import {
	processSourceInBatches,
	processSourceInBatchesStreaming,
} from './embeddings.js';

export type BackfillOptions = {
	skipExisting?: boolean;
	onProgress?: (completed: number, total: number, sourceTitle: string) => void;
	onError?: (sourceId: string, error: Error) => void;
};

export type BackfillResult = {
	totalSources: number;
	processedSources: number;
	skippedSources: number;
	failedSources: number;
	totalChunks: number;
	errors: Array<{sourceId: string; error: Error}>;
};

/**
 * Processes all sources to generate embeddings with controlled concurrency.
 * Uses p-limit to process 2 sources at a time, preventing memory buildup.
 * Each source is fully processed (chunk → embed → store) before moving on.
 * Sources are loaded one at a time to minimize memory usage.
 */
export async function backfillEmbeddings(
	options: BackfillOptions = {},
): Promise<BackfillResult> {
	const {skipExisting = true, onProgress, onError} = options;

	const result: BackfillResult = {
		totalSources: 0,
		processedSources: 0,
		skippedSources: 0,
		failedSources: 0,
		totalChunks: 0,
		errors: [],
	};

	const minimalSources = await sources.getAllMinimal();
	result.totalSources = minimalSources.length;

	const limit = pLimit(1);

	const processSource = async (sourceMetadata: {id: string; title: string}) => {
		let source;
		try {
			if (onProgress) {
				onProgress(
					result.processedSources + result.skippedSources,
					result.totalSources,
					`[1/4] Checking: ${sourceMetadata.title}`,
				);
			}

			if (skipExisting) {
				const hasEmbeddings = await sourceChunks.hasEmbeddings(
					sourceMetadata.id,
				);
				if (hasEmbeddings) {
					result.skippedSources++;
					if (onProgress) {
						onProgress(
							result.processedSources + result.skippedSources,
							result.totalSources,
							`Skipped: ${sourceMetadata.title} (already has embeddings)`,
						);
					}

					return;
				}
			}

			if (onProgress) {
				onProgress(
					result.processedSources + result.skippedSources,
					result.totalSources,
					`[2/4] Loading: ${sourceMetadata.title}`,
				);
			}

			source = await sources.getById(sourceMetadata.id);

			if (!source) {
				result.skippedSources++;
				if (onProgress) {
					onProgress(
						result.processedSources + result.skippedSources,
						result.totalSources,
						`Skipped: ${sourceMetadata.title} (not found)`,
					);
				}

				return;
			}

			if (!source.jina_archive_contents) {
				result.skippedSources++;
				if (onProgress) {
					onProgress(
						result.processedSources + result.skippedSources,
						result.totalSources,
						`Skipped: ${sourceMetadata.title} (no content)`,
					);
				}

				return;
			}

			if (onProgress) {
				onProgress(
					result.processedSources + result.skippedSources,
					result.totalSources,
					`[3/4] Processing: ${sourceMetadata.title}`,
				);
			}

			const chunkGenerator = semanticChunkGenerator(
				source.jina_archive_contents,
			);

			const chunkCount = await processSourceInBatchesStreaming(
				source.id,
				chunkGenerator,
			);

			if (chunkCount === 0) {
				result.skippedSources++;
				if (onProgress) {
					onProgress(
						result.processedSources + result.skippedSources,
						result.totalSources,
						`Skipped: ${sourceMetadata.title} (no chunks generated)`,
					);
				}

				return;
			}

			result.processedSources++;
			result.totalChunks += chunkCount;

			if (onProgress) {
				onProgress(
					result.processedSources + result.skippedSources,
					result.totalSources,
					`✓ Complete: ${sourceMetadata.title} (${chunkCount} chunks)`,
				);
			}

			source = null;

			if (global.gc) {
				global.gc();
			}
		} catch (error) {
			result.failedSources++;
			const err = error as Error;
			result.errors.push({sourceId: sourceMetadata.id, error: err});

			if (onError) {
				onError(sourceMetadata.id, err);
			}

			if (onProgress) {
				onProgress(
					result.processedSources + result.skippedSources + result.failedSources,
					result.totalSources,
					`✗ Failed: ${sourceMetadata.title} - ${err.message}`,
				);
			}

			console.error(
				`Failed to process source ${sourceMetadata.id} (${sourceMetadata.title}):`,
				err.message,
				err.stack,
			);
		} finally {
			source = null;
		}
	};

	await Promise.all(
		minimalSources.map(source => limit(() => processSource(source))),
	);

	return result;
}

export async function processSource(sourceId: string): Promise<void> {
	const source = await sources.getById(sourceId);

	if (!source) {
		throw new Error(`Source not found: ${sourceId}`);
	}

	if (!source.jina_archive_contents) {
		throw new Error(`Source has no content: ${sourceId}`);
	}

	await sourceChunks.deleteBySourceId(sourceId);

	const chunks = semanticChunk(source.jina_archive_contents);

	if (chunks.length === 0) {
		throw new Error(`No chunks generated for source: ${sourceId}`);
	}

	await processSourceInBatches(sourceId, chunks);
}

export async function reprocessSource(sourceId: string): Promise<void> {
	await processSource(sourceId);
}
