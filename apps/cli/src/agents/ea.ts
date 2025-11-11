import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getEssay} from '../tools/storage.js';
import {getSectionsList} from './ja.js';
import {config} from '../config.js';

export type OutlineReview = {
	overallScore: number;
	strengths: string[];
	weaknesses: string[];
	suggestions: string[];
	sectionFeedback: Array<{
		number: number;
		title: string;
		issues: string[];
		recommendations: string[];
	}>;
};

export type SectionReview = {
	sectionNumber: number;
	sectionTitle: string;
	score: number;
	strengths: string[];
	issues: string[];
	suggestions: string[];
	citationUsage: 'excellent' | 'good' | 'needs_work';
	keyPointsCovered: boolean[];
	recommendedChanges: string;
};

const client = new Anthropic({
	apiKey: config.claude.apiKey,
});

async function readOutlineFile(essaySlug: string): Promise<string> {
	const outlinePath = path.join(
		process.cwd(),
		'essays',
		essaySlug,
		'0-outline.md',
	);
	return fs.readFile(outlinePath, 'utf-8');
}

async function writeOutlineFile(
	essaySlug: string,
	content: string,
): Promise<void> {
	const outlinePath = path.join(
		process.cwd(),
		'essays',
		essaySlug,
		'0-outline.md',
	);
	await fs.writeFile(outlinePath, content, 'utf-8');
}

export async function reviewOutline(
	essaySlug: string,
	onProgress?: (status: string) => void,
): Promise<OutlineReview> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress('Reading outline...');
	const essay = await getEssay(essaySlug);
	if (!essay) {
		throw new Error(`Essay with slug "${essaySlug}" not found`);
	}

	const outlineContent = await readOutlineFile(essaySlug);

	progress('Analyzing outline structure...');

	const prompt = `You are an expert editor reviewing an essay outline.

Essay Title: ${essay.title}

Outline:
${outlineContent}

Analyze this outline for:
1. Logical flow and structure
2. Appropriate scope for each section
3. Missing topics or gaps
4. Redundancy or overlap
5. Word count distribution
6. Coverage and depth

CRITICAL: Return ONLY valid JSON. No explanations before or after.

Format:
{
  "overallScore": 7,
  "strengths": [
    "Clear logical progression",
    "Good balance of sections"
  ],
  "weaknesses": [
    "Section 3 too broad",
    "Missing counterarguments"
  ],
  "suggestions": [
    "Add transition between sections 2 and 3",
    "Expand conclusion with actionable takeaways"
  ],
  "sectionFeedback": [
    {
      "number": 1,
      "title": "Introduction",
      "issues": ["Hook could be stronger"],
      "recommendations": ["Start with specific statistic or story"]
    }
  ]
}

Be specific and actionable. Return ONLY the JSON object, nothing else.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 4096,
		messages: [{role: 'user', content: prompt}],
	});

	const textBlock = message.content.find(block => block.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Could not extract JSON from Claude response');
	}

	try {
		const review = JSON.parse(jsonMatch[0]) as OutlineReview;
		progress('Outline review complete!');
		return review;
	} catch (error) {
		const preview = jsonMatch[0].substring(0, 500);
		throw new Error(
			`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}\nJSON preview: ${preview}...`,
		);
	}
}

export async function refineOutline(
	essaySlug: string,
	userFeedback: string,
	review: OutlineReview | null,
	onProgress?: (status: string) => void,
): Promise<void> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress('Reading current outline...');
	const essay = await getEssay(essaySlug);
	if (!essay) {
		throw new Error(`Essay with slug "${essaySlug}" not found`);
	}

	const outlineContent = await readOutlineFile(essaySlug);

	progress('Refining outline with Claude...');

	const reviewContext = review
		? `
Previous Review Results:
- Overall Score: ${review.overallScore}/10
- Strengths: ${review.strengths.join(', ')}
- Issues: ${review.weaknesses.join(', ')}
- Suggestions: ${review.suggestions.join(', ')}
`
		: '';

	const prompt = `You are an expert editor refining an essay outline.

Essay Title: ${essay.title}

Current Outline:
${outlineContent}
${reviewContext}
Editor Feedback:
${userFeedback}

Refine this outline based on the feedback and review results. Maintain the same markdown format with:
- Essay title as H1
- "## Outline" section
- Each section as H3 with number and title
- Bullet points for key points
- Target word counts

Return ONLY the refined outline content in markdown format, no explanations.`;

	const stream = await client.messages.stream({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 4096,
		messages: [{role: 'user', content: prompt}],
	});

	let refinedContent = '';

	for await (const chunk of stream) {
		if (
			chunk.type === 'content_block_delta' &&
			chunk.delta.type === 'text_delta'
		) {
			const text = chunk.delta.text;
			refinedContent += text;
			progress(text);
		}
	}

	progress('\n\nSaving refined outline...');
	await writeOutlineFile(essaySlug, refinedContent.trim());

	progress('Outline refinement complete!');
}

export async function reviewSection(
	essaySlug: string,
	sectionNumber: number,
	onProgress?: (status: string) => void,
): Promise<SectionReview> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Reviewing section ${sectionNumber}...`);

	const sections = await getSectionsList(essaySlug);
	const section = sections.find(s => s.number === sectionNumber);

	if (!section) {
		throw new Error(`Section ${sectionNumber} not found`);
	}

	if (!section.currentContent || section.currentContent.trim().length === 0) {
		throw new Error(`Section ${sectionNumber} has no content to review`);
	}

	progress('Analyzing section content...');

	const prompt = `You are an expert editor reviewing an essay section.

Section: ${section.number}. ${section.title}
Target Words: ${section.targetWords}
Current Words: ${section.currentContent.split(/\s+/).length}

Key Points Required:
${section.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Content:
${section.currentContent}

Evaluate:
1. Coverage of all key points
2. Clarity and coherence
3. Citation usage and quality
4. Writing quality and flow
5. Adherence to target length

CRITICAL: Return ONLY valid JSON. No explanations before or after.

Format:
{
  "sectionNumber": ${sectionNumber},
  "sectionTitle": "${section.title}",
  "score": 8,
  "strengths": [
    "Clear argument progression",
    "Good use of sources"
  ],
  "issues": [
    "Missing transition in paragraph 3",
    "Key point 2 not fully addressed"
  ],
  "suggestions": [
    "Add more specific examples",
    "Strengthen conclusion"
  ],
  "citationUsage": "good",
  "keyPointsCovered": [true, true, false],
  "recommendedChanges": "Add paragraph addressing key point 3 about economic impacts. Strengthen transition between paragraphs 2 and 3."
}

Be specific and actionable. Return ONLY the JSON object, nothing else.`;

	const message = await client.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 4096,
		messages: [{role: 'user', content: prompt}],
	});

	const textBlock = message.content.find(block => block.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error('Could not extract JSON from Claude response');
	}

	try {
		const review = JSON.parse(jsonMatch[0]) as SectionReview;
		progress('Section review complete!');
		return review;
	} catch (error) {
		const preview = jsonMatch[0].substring(0, 500);
		throw new Error(
			`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}\nJSON preview: ${preview}...`,
		);
	}
}

export async function refineSection(
	essaySlug: string,
	sectionNumber: number,
	userFeedback: string,
	review: SectionReview | null,
	onProgress?: (status: string) => void,
): Promise<void> {
	const progress = (msg: string) => {
		if (onProgress) {
			onProgress(msg);
		}
	};

	progress(`Refining section ${sectionNumber}...`);

	const sections = await getSectionsList(essaySlug);
	const section = sections.find(s => s.number === sectionNumber);

	if (!section) {
		throw new Error(`Section ${sectionNumber} not found`);
	}

	const essayDir = path.join(process.cwd(), 'essays', essaySlug);
	const sectionsDir = path.join(essayDir, 'sections');
	const files = await fs.readdir(sectionsDir);
	const sectionFile = files.find(f => f.startsWith(`${sectionNumber}-`));

	if (!sectionFile) {
		throw new Error(`Section ${sectionNumber} file not found`);
	}

	const sectionPath = path.join(sectionsDir, sectionFile);

	progress('Refining content with Claude...');

	const reviewContext = review
		? `
Previous Review Results:
- Score: ${review.score}/10
- Citation Usage: ${review.citationUsage}
- Strengths: ${review.strengths.join(', ')}
- Issues: ${review.issues.join(', ')}
- Suggestions: ${review.suggestions.join(', ')}
`
		: '';

	const prompt = `You are an expert editor refining an essay section.

Section: ${section.number}. ${section.title}
Target Words: ${section.targetWords}

Key Points to Cover:
${section.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Current Content:
${section.currentContent}
${reviewContext}
Editor Feedback:
${userFeedback}

Refine this section based on the feedback and review results. Maintain:
- Professional, engaging tone
- Clear paragraph structure
- Natural citations
- Target word count (±10%)
- Coverage of all key points

Return ONLY the refined section content (no heading, that will be added automatically), no explanations.`;

	const stream = await client.messages.stream({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 8000,
		thinking: {
			type: 'enabled',
			budget_tokens: 5000,
		},
		messages: [{role: 'user', content: prompt}],
	});

	let refinedContent = '';

	for await (const chunk of stream) {
		if (
			chunk.type === 'content_block_delta' &&
			chunk.delta.type === 'text_delta'
		) {
			const text = chunk.delta.text;
			refinedContent += text;
			progress(text);
		}
	}

	progress('\n\nSaving refined section...');

	const fileContent = `# ${section.title}

## Key Points
${section.keyPoints.map(p => `- ${p}`).join('\n')}

## Target Word Count
${section.targetWords} words

## Content

${refinedContent.trim()}
`;

	await fs.writeFile(sectionPath, fileContent, 'utf-8');

	progress('Section refinement complete!');
}
