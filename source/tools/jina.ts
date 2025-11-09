import {config} from '../config.js';

export type Article = {
	title: string;
	content: string;
	url: string;
};

export async function extractArticle(url: string): Promise<Article> {
	const jinaUrl = `https://r.jina.ai/${url}`;

	try {
		const response = await fetch(jinaUrl, {
			headers: {
				Authorization: `Bearer ${config.jina.apiKey}`,
				'X-Return-Format': 'markdown',
			},
		});

		if (!response.ok) {
			throw new Error(
				`Jina API error: ${response.status} ${response.statusText}`,
			);
		}

		const markdown = await response.text();

		const titleMatch = markdown.match(/^#\s+(.+)$/m);
		const title = titleMatch ? titleMatch[1] : new URL(url).hostname;

		return {
			title,
			content: markdown,
			url,
		};
	} catch (error) {
		console.error(`Failed to extract article from ${url}:`, error);
		throw error;
	}
}
