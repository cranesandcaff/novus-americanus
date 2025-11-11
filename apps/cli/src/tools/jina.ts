import {config} from '../config.js';

export type Article = {
	title: string;
	content: string;
	url: string;
};

type JinaResponse = {
	code: number;
	status: number;
	data: {
		title: string;
		description: string;
		url: string;
		content: string;
		publishedTime?: string;
		metadata?: {
			lang?: string;
			viewport?: string;
		};
		warning?: string;
		usage?: {
			tokens: number;
		};
	};
};

export async function extractArticle(url: string): Promise<Article> {
	const jinaUrl = `https://r.jina.ai/${url}`;

	try {
		const response = await fetch(jinaUrl, {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${config.jina.apiKey}`,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Jina API error: ${response.status} ${response.statusText}`,
			);
		}

		const jsonResponse: JinaResponse = await response.json();

		if (jsonResponse.code !== 200) {
			throw new Error(
				`Jina API returned error code: ${jsonResponse.code} (status: ${jsonResponse.status})`,
			);
		}

		const {data} = jsonResponse;

		if (!data.content || data.content.trim().length < 100) {
			throw new Error('Content too short - likely an error page');
		}

		return {
			title: data.title || new URL(url).hostname,
			content: data.content,
			url: data.url,
		};
	} catch (error) {
		console.error(`Failed to extract article from ${url}:`, error);
		throw error;
	}
}
