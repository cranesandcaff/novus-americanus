import Anthropic from '@anthropic-ai/sdk';
import slugify from '@sindresorhus/slugify';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getEssay, getResearchSummaries, updateEssayStatus} from '../tools/storage.js';
import {config} from '../config.js';

export type OutlineResult = {
	sectionsCreated: number;
	outlinePath: string;
	essayDirectory: string;
};

type OutlineSection = {
	number: number;
	title: string;
	keyPoints: string[];
	targetWords: number;
};

type GeneratedOutline = {
	essayTitle: string;
	totalWords: number;
	sections: OutlineSection[];
};

const client = new Anthropic({
	apiKey: config.claude.apiKey,
});

async function generateOutlineWithClaude(
	essayTitle: string,
	research: Array<{
		title: string;
		summary: string | null;
		keyPoints: string[] | null;
	}>,
): Promise<GeneratedOutline> {
	const researchContext = research
		.map((r, i) => {
			const summary = r.summary || 'No summary available';
			const points = r.keyPoints?.length
				? '\nKey Points:\n' + r.keyPoints.map(p => `  - ${p}`).join('\n')
				: '';
			return `${i + 1}. ${r.title}\n   ${summary}${points}`;
		})
		.join('\n\n');

	const prompt = `You are an expert essay writer creating a detailed outline for an essay.

Essay Topic: ${essayTitle}

Research Summaries:
${researchContext}

Create a comprehensive outline for this essay with:
- 5-8 main sections (including Introduction and Conclusion)
- Each section should have 2-4 specific key points or sub-topics
- Suggest realistic word count targets for each section
- Total essay should be 4000-6000 words

Return your response as JSON in this exact format:
{
  "essayTitle": "The actual essay title (refined if needed)",
  "totalWords": 5000,
  "sections": [
    {
      "number": 2,
      "title": "Introduction",
      "keyPoints": [
        "Hook with compelling statistic or story",
        "Thesis statement",
        "Roadmap of essay"
      ],
      "targetWords": 500
    },
    {
      "number": 3,
      "title": "Background",
      "keyPoints": [
        "Point 1",
        "Point 2"
      ],
      "targetWords": 800
    }
  ]
}

IMPORTANT:
- Number sections starting from 2 (0 is outline.md, 1 is meta.md)
- Make section titles descriptive and specific
- Ensure key points are actionable for writing
- Word counts should add up to approximately the total`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 4096,
		messages: [
			{
				role: 'user',
				content: prompt,
			},
		],
	});

	const textBlock = message.content.find(block => block.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Could not extract JSON from Claude response');
	}

	const outline = JSON.parse(jsonMatch[0]) as GeneratedOutline;

	if (!outline.sections || outline.sections.length === 0) {
		throw new Error('Invalid outline structure from Claude');
	}

	return outline;
}

function truncateSlug(slug: string, maxLength = 50): string {
	if (slug.length <= maxLength) {
		return slug;
	}

	return slug.substring(0, maxLength);
}

async function ensureEssayDirectory(slug: string): Promise<string> {
	const essaysDir = path.join(process.cwd(), 'essays');
	const essayDir = path.join(essaysDir, slug);
	const sectionsDir = path.join(essayDir, 'sections');

	await fs.mkdir(essaysDir, {recursive: true});
	await fs.mkdir(essayDir, {recursive: true});
	await fs.mkdir(sectionsDir, {recursive: true});

	return essayDir;
}

async function writeOutlineFile(
	essayDir: string,
	outline: GeneratedOutline,
): Promise<void> {
	let content = `# ${outline.essayTitle}\n\n## Outline\n\n`;

	for (const section of outline.sections) {
		content += `### ${section.number}. ${section.title}\n`;
		for (const point of section.keyPoints) {
			content += `- ${point}\n`;
		}

		content += `*Target: ${section.targetWords} words*\n\n`;
	}

	const outlinePath = path.join(essayDir, '0-outline.md');
	await fs.writeFile(outlinePath, content, 'utf-8');
}

async function writeMetadataFile(
	essayDir: string,
	slug: string,
	outline: GeneratedOutline,
): Promise<void> {
	const now = new Date().toISOString().split('T')[0];

	const content = `---
slug: ${slug}
title: ${outline.essayTitle}
status: outlining
target_words: ${outline.totalWords}
sections: ${outline.sections.length}
created: ${now}
updated: ${now}
---

# Essay Metadata

**Current Status:** Outlining complete, ready for writing
**Progress:** 0 / ${outline.sections.length} sections written
**Total Target:** ${outline.totalWords} words
`;

	const metaPath = path.join(essayDir, '1-meta.md');
	await fs.writeFile(metaPath, content, 'utf-8');
}

async function writeSectionStubs(
	essayDir: string,
	sections: OutlineSection[],
): Promise<void> {
	const sectionsDir = path.join(essayDir, 'sections');

	for (const section of sections) {
		const sectionSlug = truncateSlug(slugify(section.title));
		const filename = `${section.number}-${sectionSlug}.md`;
		const filePath = path.join(sectionsDir, filename);

		let content = `# ${section.title}\n\n`;
		content += `## Key Points\n`;
		for (const point of section.keyPoints) {
			content += `- ${point}\n`;
		}

		content += `\n## Target Word Count\n${section.targetWords} words\n\n`;
		content += `## Content\n\n[To be written by Journalist Agent]\n`;

		await fs.writeFile(filePath, content, 'utf-8');
	}
}

export async function createOutline(
	essaySlug: string,
	onProgress?: (status: string) => void,
): Promise<OutlineResult> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Starting outline generation for: ${essaySlug}`);

	const essay = await getEssay(essaySlug);
	if (!essay) {
		throw new Error(`Essay with slug "${essaySlug}" not found`);
	}

	progress(`Fetching research summaries...`);
	const research = await getResearchSummaries(essaySlug);

	if (research.length === 0) {
		throw new Error(
			`No research found for essay "${essaySlug}". Run research first.`,
		);
	}

	progress(`Found ${research.length} research articles`);
	progress(`Generating outline with Claude...`);

	const outline = await generateOutlineWithClaude(essay.title, research);

	progress(
		`Generated outline with ${outline.sections.length} sections (~${outline.totalWords} words)`,
	);

	progress(`Creating essay directory structure...`);
	const essayDir = await ensureEssayDirectory(essaySlug);

	progress(`Writing 0-outline.md...`);
	await writeOutlineFile(essayDir, outline);

	progress(`Writing 1-meta.md...`);
	await writeMetadataFile(essayDir, essaySlug, outline);

	progress(`Creating ${outline.sections.length} section stub files...`);
	await writeSectionStubs(essayDir, outline.sections);

	progress(`Updating essay status...`);
	await updateEssayStatus(essaySlug, 'outlining');

	progress(`\nOutline generation complete!`);

	return {
		sectionsCreated: outline.sections.length,
		outlinePath: path.join(essayDir, '0-outline.md'),
		essayDirectory: essayDir,
	};
}
