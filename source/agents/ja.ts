import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getEssay, getResearchSummaries, type ResearchSummary} from '../tools/storage.js';
import {config} from '../config.js';

export type JournalistResult = {
	sectionNumber: number;
	sectionTitle: string;
	wordsWritten: number;
	targetWords: number;
	sourcesUsed: number;
};

type SectionMetadata = {
	number: number;
	title: string;
	keyPoints: string[];
	targetWords: number;
	currentContent: string;
};

const client = new Anthropic({
	apiKey: config.claude.apiKey,
});

async function getSectionFilePath(
	essaySlug: string,
	sectionNumber: number,
): Promise<string | null> {
	const essayDir = path.join(process.cwd(), 'essays', essaySlug);
	const sectionsDir = path.join(essayDir, 'sections');

	try {
		const files = await fs.readdir(sectionsDir);
		const sectionFile = files.find(f => f.startsWith(`${sectionNumber}-`));

		if (!sectionFile) {
			return null;
		}

		return path.join(sectionsDir, sectionFile);
	} catch {
		return null;
	}
}

async function parseSectionFile(filePath: string): Promise<SectionMetadata> {
	const content = await fs.readFile(filePath, 'utf-8');
	const lines = content.split('\n');

	const titleMatch = lines[0]?.match(/^# (.+)$/);
	const title = titleMatch?.[1] || 'Untitled Section';

	const keyPoints: string[] = [];
	let targetWords = 500;
	let currentContent = '';
	let inKeyPoints = false;
	let inContent = false;

	for (const line of lines) {
		if (line.startsWith('## Key Points')) {
			inKeyPoints = true;
			inContent = false;
			continue;
		}

		if (line.startsWith('## Target Word Count')) {
			inKeyPoints = false;
			inContent = false;
			continue;
		}

		if (line.startsWith('## Content')) {
			inKeyPoints = false;
			inContent = true;
			continue;
		}

		if (inKeyPoints && line.startsWith('- ')) {
			keyPoints.push(line.substring(2));
		}

		if (inContent && line.trim() && !line.includes('[To be written')) {
			currentContent += line + '\n';
		}

		const wordCountMatch = line.match(/(\d+)\s+words/);
		if (wordCountMatch?.[1]) {
			targetWords = Number.parseInt(wordCountMatch[1], 10);
		}
	}

	const fileNameMatch = path.basename(filePath).match(/^(\d+)-/);
	const number = fileNameMatch?.[1] ? Number.parseInt(fileNameMatch[1], 10) : 0;

	return {
		number,
		title,
		keyPoints,
		targetWords,
		currentContent: currentContent.trim(),
	};
}

async function getRelevantSources(
	essaySlug: string,
	sectionTitle: string,
	keyPoints: string[],
): Promise<ResearchSummary[]> {
	const allSources = await getResearchSummaries(essaySlug);

	const searchTerms = [
		...sectionTitle.toLowerCase().split(/\s+/),
		...keyPoints.flatMap(kp => kp.toLowerCase().split(/\s+/)),
	].filter(term => term.length > 3);

	const scoredSources = allSources.map(source => {
		const sourceText = `${source.title} ${source.summary} ${source.keyPoints?.join(' ')}`.toLowerCase();

		const score = searchTerms.reduce((acc, term) => {
			const count = (sourceText.match(new RegExp(term, 'g')) || []).length;
			return acc + count;
		}, 0);

		return {source, score};
	});

	scoredSources.sort((a, b) => b.score - a.score);

	return scoredSources.slice(0, 10).map(s => s.source);
}

function countWords(text: string): number {
	return text.split(/\s+/).filter(word => word.length > 0).length;
}

async function generateSectionContent(
	essayTitle: string,
	metadata: SectionMetadata,
	sources: ResearchSummary[],
): Promise<string> {
	const sourcesContext = sources
		.map((s, i) => {
			const keyPointsStr = s.keyPoints?.length
				? '\nKey Points: ' + s.keyPoints.join('; ')
				: '';
			return `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.summary}${keyPointsStr}`;
		})
		.join('\n\n');

	const prompt = `You are a professional journalist writing a section of an essay.

Essay Title: ${essayTitle}
Section: ${metadata.number}. ${metadata.title}
Target Word Count: ${metadata.targetWords} words

Key Points to Cover:
${metadata.keyPoints.map(p => `- ${p}`).join('\n')}

Available Research Sources:
${sourcesContext}

Write this section following these requirements:
- Cover all key points thoroughly
- Use research sources and cite them naturally (e.g., "According to [source title]...")
- Target ${metadata.targetWords} words (±10% acceptable)
- Maintain professional, engaging tone
- Use clear topic sentences and transitions
- Support claims with evidence from sources
- Do not include a section heading (it will be added automatically)
- Write in markdown format with proper paragraphs

Write the complete section now:`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 8000,
		thinking: {
			type: 'enabled',
			budget_tokens: 5000,
		},
		messages: [{role: 'user', content: prompt}],
	});

	let content = '';
	for (const block of message.content) {
		if (block.type === 'text') {
			content += block.text;
		}
	}

	return content.trim();
}

async function updateSectionFile(
	filePath: string,
	metadata: SectionMetadata,
	newContent: string,
): Promise<void> {
	const fileContent = `# ${metadata.title}

## Key Points
${metadata.keyPoints.map(p => `- ${p}`).join('\n')}

## Target Word Count
${metadata.targetWords} words

## Content

${newContent}
`;

	await fs.writeFile(filePath, fileContent, 'utf-8');
}

export async function writeSection(
	essaySlug: string,
	sectionNumber: number,
	onProgress?: (status: string) => void,
): Promise<JournalistResult> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Starting to write section ${sectionNumber}...`);

	const essay = await getEssay(essaySlug);
	if (!essay) {
		throw new Error(`Essay with slug "${essaySlug}" not found`);
	}

	const filePath = await getSectionFilePath(essaySlug, sectionNumber);
	if (!filePath) {
		throw new Error(`Section ${sectionNumber} file not found`);
	}

	progress(`Reading section metadata...`);
	const metadata = await parseSectionFile(filePath);

	progress(`Finding relevant research sources...`);
	const sources = await getRelevantSources(
		essaySlug,
		metadata.title,
		metadata.keyPoints,
	);

	progress(`Found ${sources.length} relevant sources`);
	progress(`Generating content with Claude...`);

	const content = await generateSectionContent(essay.title, metadata, sources);
	const wordsWritten = countWords(content);

	progress(`Generated ${wordsWritten} words (target: ${metadata.targetWords})`);
	progress(`Saving section...`);

	await updateSectionFile(filePath, metadata, content);

	progress(`Section ${sectionNumber} complete!`);

	return {
		sectionNumber: metadata.number,
		sectionTitle: metadata.title,
		wordsWritten,
		targetWords: metadata.targetWords,
		sourcesUsed: sources.length,
	};
}

export async function getSectionsList(
	essaySlug: string,
): Promise<SectionMetadata[]> {
	const essayDir = path.join(process.cwd(), 'essays', essaySlug);
	const sectionsDir = path.join(essayDir, 'sections');

	try {
		const files = await fs.readdir(sectionsDir);
		const sectionFiles = files
			.filter(f => f.endsWith('.md'))
			.sort((a, b) => {
				const aNum = Number.parseInt(a.split('-')[0] || '0', 10);
				const bNum = Number.parseInt(b.split('-')[0] || '0', 10);
				return aNum - bNum;
			});

		const sections: SectionMetadata[] = [];
		for (const file of sectionFiles) {
			const filePath = path.join(sectionsDir, file);
			const metadata = await parseSectionFile(filePath);
			sections.push(metadata);
		}

		return sections;
	} catch {
		return [];
	}
}
