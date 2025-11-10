import {VoyageAIClient} from 'voyageai';
import {config} from '../config.js';
import {supabase} from '../db/client.js';
import {type ChunkResult} from './chunking.js';

export type VoyageEmbedding = number[];

export type EmbeddingOptions = {
	model?: string;
	inputType?: 'document' | 'query';
	truncation?: boolean;
};

export type BatchProcessOptions = {
	batchSize?: number;
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
};

export class VoyageAPIError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public retryable = true,
	) {
		super(message);
		this.name = 'VoyageAPIError';
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function createVoyageClient(): VoyageAIClient | undefined {
	if (!config.voyage.apiKey) {
		return undefined;
	}

	return new VoyageAIClient({
		apiKey: config.voyage.apiKey,
	});
}

export async function generateEmbedding(
	text: string,
	options: EmbeddingOptions = {},
): Promise<VoyageEmbedding> {
	const client = createVoyageClient();
	if (!client) {
		throw new Error('Voyage AI API key not configured');
	}

	const response = await client.embed({
		input: text,
		model: options.model ?? 'voyage-3-large',
		inputType: options.inputType ?? 'document',
		truncation: options.truncation ?? true,
	});

	if (!response.data?.[0]?.embedding) {
		throw new Error('No embedding returned from Voyage AI');
	}

	return response.data[0].embedding;
}

export async function generateEmbeddings(
	texts: string[],
	options: EmbeddingOptions = {},
): Promise<VoyageEmbedding[]> {
	const client = createVoyageClient();
	if (!client) {
		throw new Error('Voyage AI API key not configured');
	}

	const response = await client.embed({
		input: texts,
		model: options.model ?? 'voyage-3-large',
		inputType: options.inputType ?? 'document',
		truncation: options.truncation ?? true,
	});

	if (!response.data) {
		throw new Error('No embeddings returned from Voyage AI');
	}

	return response.data
		.map(d => d.embedding)
		.filter((e): e is number[] => Boolean(e));
}

function isRetryableError(error: unknown): boolean {
	const err = error as {statusCode?: number; code?: string; message?: string};

	if (err.statusCode === 429) {
		return true;
	}

	if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
		return true;
	}

	if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
		return true;
	}

	if (
		err.message?.includes('connection') ||
		err.message?.includes('timeout')
	) {
		return true;
	}

	if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
		return false;
	}

	return true;
}

export async function processSourceInBatches(
	sourceId: string,
	chunks: ChunkResult[],
	options: BatchProcessOptions = {},
): Promise<void> {
	const {
		batchSize = 5,
		maxRetries = 3,
		initialDelay = 1000,
		maxDelay = 30000,
		backoffMultiplier = 2,
	} = options;

	const batches: ChunkResult[][] = [];

	for (let i = 0; i < chunks.length; i += batchSize) {
		batches.push(chunks.slice(i, i + batchSize));
	}

	for (const batch of batches) {
		let lastError: Error | undefined;
		let delay = initialDelay;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const embeddings = await generateEmbeddings(
					batch.map(c => c.content),
					{inputType: 'document'},
				);

				const chunksData = batch.map((chunk, index) => ({
					source_id: sourceId,
					content: chunk.content,
					chunk_index: chunk.index,
					token_count: chunk.tokenCount,
					start_char_offset: chunk.startOffset,
					end_char_offset: chunk.endOffset,
					heading_context: chunk.headingContext ?? null,
					metadata: chunk.metadata ?? null,
					embedding: JSON.stringify(embeddings[index]),
				}));

				const {error} = await supabase.rpc('batch_insert_chunks', {
					chunks_data: chunksData,
				});

				if (error) {
					throw error;
				}

				break;
			} catch (error) {
				lastError = error as Error;

				const isRetryable = isRetryableError(error);

				if (!isRetryable || attempt === maxRetries) {
					console.error(
						`Failed to process batch for source ${sourceId} after ${attempt} attempts:`,
						error,
					);
					throw error;
				}

				const jitter = Math.random() * 0.1 * delay;
				const totalDelay = Math.min(delay + jitter, maxDelay);

				console.log(
					`Retrying source ${sourceId} batch after ${Math.round(totalDelay)}ms...`,
				);

				await sleep(totalDelay);
				delay = delay * backoffMultiplier;
			}
		}

		if (lastError) {
			throw lastError;
		}
	}
}

export async function processSourceInBatchesStreaming(
	sourceId: string,
	chunkGenerator: Generator<ChunkResult>,
	options: BatchProcessOptions = {},
): Promise<number> {
	const {
		batchSize = 5,
		maxRetries = 3,
		initialDelay = 1000,
		maxDelay = 30000,
		backoffMultiplier = 2,
	} = options;

	let totalProcessed = 0;
	let batch: ChunkResult[] = [];

	for (const chunk of chunkGenerator) {
		batch.push(chunk);

		if (batch.length >= batchSize) {
			await processBatch(
				sourceId,
				batch,
				maxRetries,
				initialDelay,
				maxDelay,
				backoffMultiplier,
			);
			totalProcessed += batch.length;
			batch = [];
		}
	}

	if (batch.length > 0) {
		await processBatch(
			sourceId,
			batch,
			maxRetries,
			initialDelay,
			maxDelay,
			backoffMultiplier,
		);
		totalProcessed += batch.length;
	}

	return totalProcessed;
}

async function processBatch(
	sourceId: string,
	batch: ChunkResult[],
	maxRetries: number,
	initialDelay: number,
	maxDelay: number,
	backoffMultiplier: number,
): Promise<void> {
	let lastError: Error | undefined;
	let delay = initialDelay;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const embeddings = await generateEmbeddings(
				batch.map(c => c.content),
				{inputType: 'document'},
			);

			const chunksData = batch.map((chunk, index) => ({
				source_id: sourceId,
				content: chunk.content,
				chunk_index: chunk.index,
				token_count: chunk.tokenCount,
				start_char_offset: chunk.startOffset,
				end_char_offset: chunk.endOffset,
				heading_context: chunk.headingContext ?? null,
				metadata: chunk.metadata ?? null,
				embedding: JSON.stringify(embeddings[index]),
			}));

			const {error} = await supabase.rpc('batch_insert_chunks', {
				chunks_data: chunksData,
			});

			if (error) {
				throw error;
			}

			return;
		} catch (error) {
			lastError = error as Error;

			const isRetryable = isRetryableError(error);

			if (!isRetryable || attempt === maxRetries) {
				console.error(
					`Failed to process batch for source ${sourceId} after ${attempt} attempts:`,
					error,
				);
				throw error;
			}

			const jitter = Math.random() * 0.1 * delay;
			const totalDelay = Math.min(delay + jitter, maxDelay);

			console.log(
				`Retrying source ${sourceId} batch after ${Math.round(totalDelay)}ms...`,
			);

			await sleep(totalDelay);
			delay = delay * backoffMultiplier;
		}
	}

	if (lastError) {
		throw lastError;
	}
}
