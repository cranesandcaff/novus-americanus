import Anthropic from '@anthropic-ai/sdk';
import {config} from '../config.js';

export type ArticleSummary = {
	summary: string;
	keyPoints: string[];
};

const client = new Anthropic({
	apiKey: config.claude.apiKey,
});

function truncateContent(content: string, maxChars = 200000): string {
	if (content.length <= maxChars) {
		return content;
	}

	const firstPartSize = Math.floor(maxChars * 0.4);
	const lastPartSize = Math.floor(maxChars * 0.2);

	const firstPart = content.substring(0, firstPartSize);
	const lastPart = content.substring(content.length - lastPartSize);

	return `${firstPart}\n\n[... middle section omitted for length ...]\n\n${lastPart}`;
}

export async function summarizeArticle(
	content: string,
	title: string,
): Promise<ArticleSummary> {
	const truncatedContent = truncateContent(content);

	const message = await client.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 2048,
		messages: [
			{
				role: 'user',
				content: `Analyze the following article and provide:

1. A concise summary (2-3 sentences) that captures the main thesis and key findings
2. A list of 3-5 key points as bullet points

Note: Very long articles may have their middle sections omitted, but you should still be able to understand the main points from the beginning and conclusion.

Article Title: ${title}

Article Content:
${truncatedContent}

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."]
}`,
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

	const result = JSON.parse(jsonMatch[0]) as ArticleSummary;

	if (!result.summary || !result.keyPoints) {
		throw new Error('Invalid response format from Claude');
	}

	return result;
}
