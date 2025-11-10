export type ChunkResult = {
	content: string;
	index: number;
	tokenCount: number;
	startOffset: number;
	endOffset: number;
	headingContext?: string;
	metadata?: Record<string, unknown>;
};

export type ChunkMetadata = {
	hasCode: boolean;
	hasQuote: boolean;
	hasList: boolean;
	hasCitation: boolean;
	paragraphCount: number;
};

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function extractChunkMetadata(content: string): ChunkMetadata {
	return {
		hasCode: /```[\s\S]*?```/.test(content),
		hasQuote: /[""].*?[""]/.test(content) || />\s/.test(content),
		hasList: /^\s*[-*•]\s/m.test(content) || /^\s*\d+\.\s/m.test(content),
		hasCitation: /\[\d+\]|\(\d{4}\)/.test(content),
		paragraphCount: (content.match(/\n\n/g) || []).length + 1,
	};
}

export function semanticChunk(
	text: string,
	targetSize = 512,
	overlapRatio = 0.15,
): ChunkResult[] {
	const targetChars = targetSize * CHARS_PER_TOKEN;
	const overlapChars = Math.floor(targetChars * overlapRatio);

	const chunks: ChunkResult[] = [];
	let currentHeading = '';
	let position = 0;
	let chunkIndex = 0;

	const headingPattern = /^#{1,6}\s+(.+)$/gm;

	while (position < text.length) {
		const searchEnd = Math.min(position + 200, text.length);
		const searchText = text.substring(position, searchEnd);
		const headingMatch = headingPattern.exec(searchText);
		if (headingMatch?.[1]) {
			currentHeading = headingMatch[1];
		}

		let endPosition = position + targetChars;

		const boundaries = ['\n\n', '\n', '. ', ', ', ' '];
		for (const boundary of boundaries) {
			const maxSearch = Math.min(endPosition, text.length);
			const boundaryIndex = text.lastIndexOf(boundary, maxSearch);
			if (boundaryIndex > position + targetChars * 0.8) {
				endPosition = boundaryIndex + boundary.length;
				break;
			}
		}

		endPosition = Math.min(endPosition, text.length);

		const chunkContent = text.substring(position, endPosition);

		chunks.push({
			content: chunkContent,
			index: chunkIndex,
			tokenCount: estimateTokens(chunkContent),
			startOffset: position,
			endOffset: endPosition,
			headingContext: currentHeading || undefined,
			metadata: extractChunkMetadata(chunkContent),
		});

		const nextPosition = endPosition - overlapChars;

		if (nextPosition <= position) {
			position = endPosition;
		} else {
			position = nextPosition;
		}

		chunkIndex++;

		if (position >= text.length - 10) {
			break;
		}
	}

	return chunks;
}

export function* semanticChunkGenerator(
	text: string,
	targetSize = 512,
	overlapRatio = 0.15,
): Generator<ChunkResult> {
	const targetChars = targetSize * CHARS_PER_TOKEN;
	const overlapChars = Math.floor(targetChars * overlapRatio);

	let currentHeading = '';
	let position = 0;
	let chunkIndex = 0;

	const headingPattern = /^#{1,6}\s+(.+)$/gm;

	while (position < text.length) {
		const searchEnd = Math.min(position + 200, text.length);
		const searchText = text.substring(position, searchEnd);
		const headingMatch = headingPattern.exec(searchText);
		if (headingMatch?.[1]) {
			currentHeading = headingMatch[1];
		}

		let endPosition = position + targetChars;

		const boundaries = ['\n\n', '\n', '. ', ', ', ' '];
		for (const boundary of boundaries) {
			const maxSearch = Math.min(endPosition, text.length);
			const boundaryIndex = text.lastIndexOf(boundary, maxSearch);
			if (boundaryIndex > position + targetChars * 0.8) {
				endPosition = boundaryIndex + boundary.length;
				break;
			}
		}

		endPosition = Math.min(endPosition, text.length);

		const chunkContent = text.substring(position, endPosition);

		yield {
			content: chunkContent,
			index: chunkIndex,
			tokenCount: estimateTokens(chunkContent),
			startOffset: position,
			endOffset: endPosition,
			headingContext: currentHeading || undefined,
			metadata: extractChunkMetadata(chunkContent),
		};

		const nextPosition = endPosition - overlapChars;

		if (nextPosition <= position) {
			position = endPosition;
		} else {
			position = nextPosition;
		}

		chunkIndex++;

		if (position >= text.length - 10) {
			break;
		}
	}
}
